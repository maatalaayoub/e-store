"use client";

/**
 * Inline checkout section — renders a full checkout form on the product
 * page itself so customers can buy without navigating away.
 *
 * Reuses the shared `useCheckoutForm` hook + `CheckoutFields` /
 * `CheckoutActions` components, so this stays in lockstep with the main
 * checkout page.
 */

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Tag, Loader2, X } from "lucide-react";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { parsePrice } from "@/lib/price";
import { computePromoDiscount } from "@/lib/promo";
import { resolveProductTranslation } from "@/lib/product-locale";
import { useCheckoutForm } from "@/components/shop/checkout/useCheckoutForm";
import CheckoutFields from "@/components/shop/checkout/CheckoutFields";
import CheckoutActions from "@/components/shop/checkout/CheckoutActions";
import { ALL_FIELDS } from "@/components/shop/checkout/constants";
import { useProductQtyStore } from "@/store/useProductQtyStore";

export default function InlineCheckoutSection({ section, product, locale, dict, compact = false }) {
  const router = useRouter();
  const { formatPrice, currency, rate, setCurrencyByCountry } = useCurrency();

  const tCheckout = dict?.checkout ?? {};
  const tProduct = dict?.product ?? {};

  const cfg = section?.config ?? {};
  const content = section?.content ?? {};
  const visibleFields = Array.isArray(cfg.fields) && cfg.fields.length > 0 ? cfg.fields : ALL_FIELDS;
  const fieldOrder = visibleFields;
  const showCoupon = cfg.show_coupon !== false;
  const showPlaceOrder = cfg.show_place_order !== false;
  const showWhatsApp = cfg.show_whatsapp !== false;
  const showStripe = cfg.show_stripe !== false;
  const whatsappCountries = Array.isArray(cfg.whatsapp_countries)
    ? cfg.whatsapp_countries
    : null;
  const showSummary = cfg.show_summary !== false;

  const qty = useProductQtyStore((s) => s.getQty(product?.id));
  // Variant/color/size selection published by ProductPurchasePanel. Carries the
  // configuration-adjusted unit price so the summary + order match the picker.
  const selection = useProductQtyStore((s) => s.selections[product?.id] ?? null);
  const isOutOfStock = (selection?.stock ?? product?.stock ?? 0) <= 0;

  // ── Build the order line item from the current product + selection ───────
  const items = useMemo(() => {
    if (!product?.id) return [];
    return [
      {
        id: product.id,
        quantity: qty,
        price: selection?.basePrice ?? product.price,
        effective_price: selection?.unitPrice ?? product.effective_price ?? product.price,
        name: product.name,
        translations: product.translations,
        images: product.images,
        stock: selection?.stock ?? product.stock,
        // Pass the picked variant so the server reprices the line correctly
        // and the order records what the customer chose.
        selectedColor: selection?.selectedColor ?? null,
        selectedSize: selection?.selectedSize ?? null,
        selectedVariant: selection?.selectedVariant ?? null,
      },
    ];
  }, [product, qty, selection]);

  const subtotal = items.reduce(
    (acc, it) => acc + parsePrice(it.effective_price ?? it.price) * it.quantity,
    0,
  );

  // Required fields = visible fields minus optional ones (state).
  const requiredFields = useMemo(
    () => visibleFields.filter((f) => f !== "state"),
    [visibleFields],
  );

  const [promoCode, setPromoCode] = useState("");
  const [promo, setPromo] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState(null);

  // Storefront order-method availability (Admin → Settings → Order Methods).
  // Mirrors the main checkout page so both stay in lockstep. Defaults keep COD
  // available if the config can't be loaded.
  const [payCfg, setPayCfg] = useState({
    cod_enabled: true,
    whatsapp_enabled: false,
    whatsapp_number: "",
    whatsapp_all_countries: false,
    online_enabled: false,
    stripe_enabled: false,
  });
  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/checkout/payment-config")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.success && json.data) setPayCfg(json.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const checkout = useCheckoutForm({
    items,
    subtotal,
    locale,
    currency,
    rate,
    formatPrice,
    requiredFields,
    promo,
    whatsappNumber: payCfg.whatsapp_number,
    onOrderSuccess: (orderId) => {
      router.push(`/${locale}/order-confirmed?id=${orderId}`);
    },
  });

  // Sync the displayed currency to the country the customer picks in the form.
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

  // Keep the applied promo consistent with the current cart. If the user
  // changes qty on the product page and the subtotal drops below the promo's
  // minimum (or climbs above its maximum, or the applicable scope is empty),
  // drop the promo so totals never go stale. Backend re-verifies on submit.
  useEffect(() => {
    if (!promo) return;
    if (items.length === 0) {
      setPromo(null);
      setPromoError(null);
      return;
    }
    if (subtotal < Number(promo.min_order_amount ?? 0)) {
      setPromo(null);
      setPromoError("min_order_not_met");
      return;
    }
    if (promo.max_order_amount != null && subtotal > Number(promo.max_order_amount)) {
      setPromo(null);
      setPromoError("max_order_exceeded");
      return;
    }
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

  if (!product?.id) return null;
  if (!checkout.hydrated) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="h-6 w-1/3 animate-pulse rounded bg-zinc-100" />
        <div className="mt-4 h-32 animate-pulse rounded bg-zinc-100" />
      </div>
    );
  }

  const resolved = resolveProductTranslation(product, locale);
  const img = Array.isArray(product.images) && product.images[0]?.url
    ? product.images[0].url
    : "/placeholder-view.svg";

  const hasBorder = Number(cfg.border_width) > 0 && cfg.border_color;
  const hasBackground = cfg.background && cfg.background !== 'transparent';

  // Build full inline style: admin background, border, + granular color CSS vars
  const BG_CLASS = { transparent: '', muted: 'bg-zinc-50', accent: 'bg-blue-50' };
  const bgClass = cfg.background === 'custom' ? '' : (BG_CLASS[cfg.background] ?? '');

  const outerStyle = {};
  if (cfg.background === 'custom' && cfg.background_color) outerStyle.backgroundColor = cfg.background_color;
  if (hasBorder) {
    outerStyle.border = `${Number(cfg.border_width)}px solid ${cfg.border_color}`;
    outerStyle.borderRadius = '0.75rem';
    outerStyle.overflow = 'hidden';
  }
  if (cfg.label_color)              outerStyle['--co-label']        = cfg.label_color;
  if (cfg.input_text_color)         outerStyle['--co-input']        = cfg.input_text_color;
  if (cfg.placeholder_color)        outerStyle['--co-placeholder']  = cfg.placeholder_color;

  // Build per-button inline style objects (most reliable — overrides Tailwind classes)
  const orderBtnStyle = {};
  if (cfg.order_btn_bg)            { orderBtnStyle.backgroundColor = cfg.order_btn_bg; orderBtnStyle.borderColor = cfg.order_btn_bg; }
  if (cfg.order_btn_text_color)      orderBtnStyle.color = cfg.order_btn_text_color;

  const waBtnStyle = {};
  if (cfg.whatsapp_btn_bg)           waBtnStyle.backgroundColor = cfg.whatsapp_btn_bg;
  if (cfg.whatsapp_btn_text_color)   waBtnStyle.color = cfg.whatsapp_btn_text_color;

  // Section-configured countries win; otherwise follow the global "all
  // countries" order-methods toggle (Morocco-only when off), like the checkout page.
  const waCountriesOnly = whatsappCountries != null
    ? whatsappCountries
    : (payCfg.whatsapp_all_countries ? null : ["Morocco"]);

  const defaultClass = !hasBorder && !hasBackground ? 'rounded-2xl border border-zinc-200 bg-white' : '';

  return (
    <div
      className={`checkout-section p-5 sm:p-7 ${bgClass} ${defaultClass}`.trim()}
      style={Object.keys(outerStyle).length ? outerStyle : undefined}
    >
      {(cfg.show_title !== false && content.title) && (
        <h2
          className="text-lg sm:text-xl font-semibold text-zinc-900"
          style={cfg.title_color ? { color: cfg.title_color } : undefined}
        >
          {content.title}
        </h2>
      )}
      {content.subtitle && (
        <p className="mt-1 text-sm text-zinc-500">{content.subtitle}</p>
      )}

      <div className={`mt-6 grid gap-8 ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1fr_minmax(280px,360px)] lg:gap-12"}`}>
        {/* ── Form fields ── */}
        <div>
          <CheckoutFields
            form={checkout.form}
            set={checkout.set}
            setCountry={checkout.setCountry}
            setCity={checkout.setCity}
            errors={checkout.errors}
            cities={checkout.cities}
            locale={locale}
            dict={dict}
            visibleFields={visibleFields}
            fieldOrder={fieldOrder}
            headingsVariant="compact"
          />
        </div>

        {/* ── Summary + actions ── */}
        <div className={compact ? "" : "lg:border-s lg:border-zinc-100 lg:ps-8"}>
          {showSummary && (() => {
            const isPromoCovered =
              !!promo &&
              (promo.applies_to === "all" ||
                (Array.isArray(promo.applicable_product_ids) &&
                  promo.applicable_product_ids.includes(String(product.id))));
            const isPercentagePromo =
              isPromoCovered && promo?.discount_type === "percentage_off";
            const effectiveRate =
              isPercentagePromo && Number(promo.applicable_subtotal) > 0
                ? Number(promo.discount_amount) / Number(promo.applicable_subtotal)
                : 0;
            const percentValue = Math.round(effectiveRate * 100);
            const lineOriginal = subtotal;
            const lineDiscounted = isPercentagePromo
              ? Math.max(0, lineOriginal * (1 - effectiveRate))
              : lineOriginal;
            return (
              <div className="rounded-xl border border-zinc-200 overflow-hidden">
                <div className="flex items-center gap-3 p-3 bg-white">
                  <div className="h-14 w-14 relative shrink-0 rounded-lg overflow-hidden border border-zinc-200 bg-white">
                    <Image src={img} alt={resolved.name} fill sizes="56px" className="object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 min-w-0">
                    <span className="text-sm font-semibold text-zinc-900 truncate">{resolved.name}</span>
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
                    {(selection?.selectedColor?.name || selection?.selectedVariant?.label || selection?.selectedSize) && (
                      <span className="text-xs text-zinc-500 truncate">
                        {[selection?.selectedColor?.name, selection?.selectedVariant?.label || selection?.selectedSize]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                    <span className="text-xs text-zinc-500">
                      {tCheckout.quantity ?? tProduct.quantity ?? "Qty"}: <span className="font-medium text-zinc-700">{qty}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {showCoupon && (
            <div className="mt-4 space-y-2">
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
          )}

          <div className="mt-4 border-t border-zinc-100 pt-4 space-y-2">
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
              <span className="text-lg font-bold text-zinc-900">
                {formatPrice(
                  Math.max(0, Math.round((subtotal - (promo?.discount_amount ?? 0)) * 100) / 100),
                )}
              </span>
            </div>
          </div>

          <div className="mt-5">
            {isOutOfStock && (
              <p className="mb-3 rounded-lg bg-zinc-100 px-3 py-2 text-center text-sm font-semibold text-zinc-600">
                {tProduct.out_of_stock ?? "Out of stock"}
              </p>
            )}
            <CheckoutActions
              dict={dict}
              placing={checkout.placing}
              placingAction={checkout.placingAction}
              errors={checkout.errors}
              form={checkout.form}
              requiredFields={requiredFields}
              itemsCount={isOutOfStock ? 0 : items.length}
              country={checkout.form.country}
              promoError={promoError}
              showPlaceOrder={showPlaceOrder && payCfg.cod_enabled}
              showWhatsApp={showWhatsApp && payCfg.whatsapp_enabled}
              whatsAppCountriesOnly={waCountriesOnly}
              showStripe={showStripe && payCfg.stripe_enabled}
              onPlaceOrder={isOutOfStock ? undefined : checkout.handlePlaceOrder}
              onOrderWhatsApp={isOutOfStock ? undefined : checkout.handleOrderWhatsApp}
              onPayStripe={isOutOfStock ? undefined : checkout.handlePayWithStripe}
              orderBtnStyle={Object.keys(orderBtnStyle).length ? orderBtnStyle : undefined}
              waBtnStyle={Object.keys(waBtnStyle).length ? waBtnStyle : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
