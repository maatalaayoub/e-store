"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Trash2, Minus, Plus, Tag, Loader2, X } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { isRtlLocale } from "@/config/constants";
import { resolveProductTranslation } from "@/lib/product-locale";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { parsePrice } from "@/lib/price";
import { computePromoDiscount } from "@/lib/promo";
import { useCheckoutForm } from "@/components/shop/checkout/useCheckoutForm";
import CheckoutFields from "@/components/shop/checkout/CheckoutFields";
import CheckoutActions from "@/components/shop/checkout/CheckoutActions";
import { getMainImage } from "@/lib/product-image";

function useStoreLogo() {
  const [logo, setLogo] = useState({ url: "", size: "140", height: "35" });
  useEffect(() => {
    fetch("/api/v1/display-settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setLogo({
            url: json.data.store_logo ?? "",
            size: json.data.store_logo_size ?? "140",
            height: json.data.store_logo_height ?? "35",
          });
        }
      })
      .catch(() => {});
  }, []);
  return logo;
}

export default function CheckoutClient({ locale, dict }) {
  const router = useRouter();
  const { items, clearCart, removeItem, updateQuantity } = useCartStore();
  const tCheckout = dict?.checkout ?? {};
  const tCart = dict?.cart ?? {};
  const tProduct = dict?.product ?? {};
  const isRtl = isRtlLocale(locale);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const logo = useStoreLogo();

  const { formatPrice, currency, rate, setCurrencyByCountry } = useCurrency();

  /** Base subtotal always stays in MAD (stored in DB as MAD). */
  const subtotal = items.reduce(
    (acc, item) => acc + parsePrice(item.effective_price ?? item.price) * item.quantity,
    0,
  );

  const [promoCode, setPromoCode] = useState("");
  const [promo, setPromo] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState(null);

  const checkout = useCheckoutForm({
    items,
    subtotal,
    locale,
    currency,
    rate,
    formatPrice,
    promo,
    onOrderSuccess: (orderId) => {
      clearCart();
      router.push(`/${locale}/order-confirmed?id=${orderId}`);
    },
  });

  // Update displayed currency to match the country the customer selects in the
  // checkout form so prices are always shown in their chosen local currency.
  useEffect(() => {
    if (checkout.form.country) {
      setCurrencyByCountry(checkout.form.country);
    }
  }, [checkout.form.country, setCurrencyByCountry]);

  const validatePromo = async () => {
    setPromoError(null);
    setPromo(null);
    const code = promoCode.trim();
    if (!code) return;
    setPromoLoading(true);
    try {
      const res = await fetch("/api/v1/promos/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, items, subtotal }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setPromoError(json.error || "invalid_code");
        return;
      }
      setPromo(json.data);
    } catch {
      setPromoError("generic");
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromo = () => {
    setPromo(null);
    setPromoError(null);
    setPromoCode("");
  };

  // Keep the applied promo in sync with the cart. If the user removes items,
  // decrements quantity, or otherwise drops the subtotal below the promo's
  // minimum — or empties the applicable scope — auto-invalidate the promo so
  // the discount and final total can never be stale. The backend re-verifies
  // this on order submit (see /api/v1/orders), this effect just keeps the UI
  // truthful without a page refresh.
  useEffect(() => {
    if (!promo) return;

    // Empty cart → drop the promo entirely.
    if (items.length === 0) {
      setPromo(null);
      setPromoError(null);
      return;
    }

    // Minimum order threshold no longer met.
    if (subtotal < Number(promo.min_order_amount ?? 0)) {
      setPromo(null);
      setPromoError("min_order_not_met");
      return;
    }

    // Order climbed above the promo's maximum eligible total.
    if (promo.max_order_amount != null && subtotal > Number(promo.max_order_amount)) {
      setPromo(null);
      setPromoError("max_order_exceeded");
      return;
    }

    // Recompute the applicable subtotal from the *current* cart. For scoped
    // promos we can only match by product id — categories were resolved to
    // product ids server-side at apply time, which is fine because checkout
    // does not let the user add new products.
    const scopeIds = promo.applies_to === "all"
      ? null
      : new Set((promo.applicable_product_ids ?? []).map(String));
    const applicableItems = scopeIds
      ? items.filter((i) => scopeIds.has(String(i.id)))
      : items;
    const applicableSubtotal = applicableItems.reduce(
      (acc, item) => acc + parsePrice(item.effective_price ?? item.price) * item.quantity,
      0,
    );

    // Scoped promo whose covered items were all removed.
    if (scopeIds && applicableSubtotal <= 0) {
      setPromo(null);
      setPromoError("not_applicable");
      return;
    }

    const newDiscount = computePromoDiscount(promo, applicableSubtotal);
    if (
      newDiscount !== promo.discount_amount ||
      applicableSubtotal !== promo.applicable_subtotal
    ) {
      setPromo((prev) =>
        prev
          ? { ...prev, discount_amount: newDiscount, applicable_subtotal: applicableSubtotal }
          : prev,
      );
    }
  }, [items, subtotal, promo]);

  if (!checkout.hydrated) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* ── Top bar ── */}
      <header className="bg-white border-b border-zinc-100">
        <div className="mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 transition-colors"
            >
              <BackIcon className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold tracking-widest uppercase text-zinc-800">
              {tCheckout.title ?? "Checkout"}
            </span>
          </div>

          {logo.url ? (
            <Link href={`/${locale}`} className="flex items-center">
              <Image
                src={logo.url}
                alt="LaCérémonie"
                width={Math.min(Math.max(parseInt(logo.size || "140", 10) || 140, 80), 320)}
                height={Math.min(Math.max(parseInt(logo.height || "35", 10) || 35, 20), 120)}
                className="h-auto w-auto max-w-full object-contain"
                style={{ maxHeight: `${Math.min(Math.max(parseInt(logo.height || "35", 10) || 35, 20), 120)}px` }}
                priority
              />
            </Link>
          ) : (
            <div className="h-5 w-32" />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_420px] xl:grid-cols-[auto_480px] gap-12 lg:gap-24">

          {/* ════ LEFT COLUMN ════ */}
          <div className="space-y-8 max-w-2xl w-full">
            <CheckoutFields
              form={checkout.form}
              set={checkout.set}
              setCountry={checkout.setCountry}
              setCity={checkout.setCity}
              errors={checkout.errors}
              cities={checkout.cities}
              locale={locale}
              dict={dict}
              headingsVariant="page"
            />
          </div>

          {/* ════ RIGHT COLUMN — Order summary ════ */}
          <div className="lg:sticky lg:top-10 h-fit w-full lg:max-w-sm border-t border-zinc-100 lg:border-t-0 pt-8 lg:pt-0">
            <div className="bg-white">

              {/* Items */}
              <div className="mb-4 pb-1">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
                  {tCheckout.order_summary ?? "Order Summary"}
                </h3>
                <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden">
                {items.length === 0 ? (
                  <p className="py-8 text-sm text-zinc-400 text-center">{tCart.empty_state_title ?? "Your cart is empty"}</p>
                ) : (
                  items.map((item) => {
                    const lineKey = item.lineKey ?? item.id;
                    const resolved = resolveProductTranslation(item, locale);
                    const price = parsePrice(item.effective_price ?? item.price);
                    const selectedColor = item.selectedColor ?? item.selected_color ?? null;
                    const selectedSize = item.selectedSize ?? item.selected_size ?? null;
                    const img = getMainImage(item) ?? "/images/placeholder-product.svg";
                    const isPromoCovered =
                      !!promo &&
                      (promo.applies_to === "all" ||
                        (Array.isArray(promo.applicable_product_ids) &&
                          promo.applicable_product_ids.includes(String(item.id))));
                    const isPercentagePromo =
                      isPromoCovered && promo?.discount_type === "percentage_off";
                    // Derive the per-line rate from the actual applied discount
                    // so the line prices always match the total shown below.
                    const effectiveRate =
                      isPercentagePromo && Number(promo.applicable_subtotal) > 0
                        ? Number(promo.discount_amount) / Number(promo.applicable_subtotal)
                        : 0;
                    const percentValue = Math.round(effectiveRate * 100);
                    const lineOriginal = price * item.quantity;
                    const lineDiscounted = isPercentagePromo
                      ? Math.max(0, lineOriginal * (1 - effectiveRate))
                      : lineOriginal;
                    return (
                      <div key={lineKey} className="flex items-center gap-4 px-4 py-4 bg-white">
                        <div className="h-16 w-16 relative shrink-0 rounded-lg overflow-hidden border border-zinc-200 bg-white">
                          <Image src={img} alt={resolved.name} fill sizes="64px" loading="eager" className="object-cover" />
                        </div>
                        <div className="flex flex-1 flex-col gap-1 min-w-0">
                          <span className="text-sm font-semibold text-zinc-900 leading-snug truncate">{resolved.name}</span>
                          {(selectedColor?.name || selectedSize) && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                              {selectedColor?.name && (
                                <span className="inline-flex items-center gap-1.5">
                                  {selectedColor?.hex && (
                                    <span
                                      aria-hidden="true"
                                      className="inline-block h-3 w-3 rounded-full border border-zinc-200"
                                      style={{ backgroundColor: selectedColor.hex }}
                                    />
                                  )}
                                  <span>{tProduct.color ?? "Color"}: <span className="font-medium text-zinc-700">{selectedColor.name}</span></span>
                                </span>
                              )}
                              {selectedSize && (
                                <span>{tProduct.size ?? "Size"}: <span className="font-medium text-zinc-700">{selectedSize}</span></span>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            {isPercentagePromo ? (
                              <>
                                <span className="text-xs text-zinc-400 line-through">
                                  {formatPrice(lineOriginal)}
                                </span>
                                <span className="text-sm font-bold text-zinc-900">
                                  {formatPrice(lineDiscounted)}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm font-bold text-zinc-900">
                                {formatPrice(lineOriginal)}
                              </span>
                            )}
                            {isPromoCovered && promo.applies_to !== "all" && (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700"
                                title={tCheckout.promo_covers_line ?? "Promo applied to this item"}
                              >
                                <Tag className="h-2.5 w-2.5" />
                                {promo.code}
                              </span>
                            )}
                            {isPercentagePromo && percentValue > 0 && (
                              <span className="inline-flex items-center rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                −{percentValue}%
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex items-center gap-0.5 rounded-full border border-zinc-200 bg-white px-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.quantity <= 1) removeItem(lineKey);
                                  else updateQuantity(lineKey, item.quantity - 1);
                                }}
                                className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 transition-colors"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="min-w-[1.5rem] text-center text-sm font-semibold text-zinc-900">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(lineKey, item.quantity + 1)}
                                disabled={item.stock != null && item.quantity >= item.stock}
                                className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(lineKey)}
                              aria-label={`Remove ${resolved.name}`}
                              className="text-zinc-300 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </div>

              <div className="border-t border-zinc-100" />

              {/* Discount code */}
              <div className="py-6 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      disabled={!!promo}
                      placeholder={tCheckout.discount_placeholder ?? "Promo code"}
                      className="w-full rounded border border-zinc-200 bg-white ps-9 pe-3 py-2 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-50"
                      dir="ltr"
                    />
                  </div>
                  {promo ? (
                    <button
                      type="button"
                      onClick={removePromo}
                      className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={promoLoading || !promoCode.trim()}
                      onClick={validatePromo}
                      className="inline-flex items-center gap-1.5 rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
                    >
                      {promoLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {tCheckout.apply ?? "Apply"}
                    </button>
                  )}
                </div>
                {promo && (
                  <p className="text-xs text-emerald-600">
                    {tCheckout.promo_applied ?? "Promo applied"}: -{formatPrice(promo.discount_amount)}
                  </p>
                )}
                {promoError && (
                  <p className="text-xs text-red-600">
                    {tCheckout.promo_error?.[promoError] ?? tCheckout.promo_error?.generic ?? "Invalid promo code."}
                  </p>
                )}
              </div>

              <div className="border-t border-zinc-100" />

              {/* Totals */}
              <div className="py-6 space-y-4">
                <div className="flex justify-between text-sm text-zinc-700">
                  <span>{tCheckout.subtotal ?? "Subtotal"}</span>
                  <span className="font-medium text-zinc-900">{formatPrice(subtotal)}</span>
                </div>
                {promo?.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>{tCheckout.discount ?? "Discount"} ({promo.code})</span>
                    <span className="font-medium">-{formatPrice(promo.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-zinc-700 items-center">
                  <span>{tCheckout.total ?? "Total"}</span>
                  <span className="text-xl font-bold text-zinc-900">
                    {formatPrice(
                      Math.max(0, Math.round((subtotal - (promo?.discount_amount ?? 0)) * 100) / 100),
                    )}
                  </span>
                </div>
              </div>

              {/* Place Order + WhatsApp */}
              <div className="pt-2 pb-10">
                <CheckoutActions
                  dict={dict}
                  placing={checkout.placing}
                  errors={checkout.errors}
                  form={checkout.form}
                  itemsCount={items.length}
                  country={checkout.form.country}
                  promoError={promoError}
                  onPlaceOrder={checkout.handlePlaceOrder}
                  onOrderWhatsApp={checkout.handleOrderWhatsApp}
                />
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
