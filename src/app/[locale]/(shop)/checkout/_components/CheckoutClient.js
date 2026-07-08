"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Trash2, Minus, Plus } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { isRtlLocale } from "@/config/constants";
import { resolveProductTranslation } from "@/lib/product-locale";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { parsePrice } from "@/lib/price";
import { useCheckoutForm } from "@/components/shop/checkout/useCheckoutForm";
import CheckoutFields from "@/components/shop/checkout/CheckoutFields";
import CheckoutActions from "@/components/shop/checkout/CheckoutActions";
import { getMainImage } from "@/lib/product-image";

function useStoreLogo() {
  const [logoUrl, setLogoUrl] = useState("");
  useEffect(() => {
    fetch("/api/v1/display-settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.store_logo) {
          setLogoUrl(json.data.store_logo);
        }
      })
      .catch(() => {});
  }, []);
  return logoUrl;
}

export default function CheckoutClient({ locale, dict }) {
  const router = useRouter();
  const { items, clearCart, removeItem, updateQuantity } = useCartStore();
  const tCheckout = dict?.checkout ?? {};
  const tCart = dict?.cart ?? {};
  const tProduct = dict?.product ?? {};
  const isRtl = isRtlLocale(locale);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const logoUrl = useStoreLogo();

  const { formatPrice, currency, rate } = useCurrency();

  /** Base subtotal always stays in MAD (stored in DB as MAD). */
  const subtotal = items.reduce(
    (acc, item) => acc + parsePrice(item.effective_price ?? item.price) * item.quantity,
    0,
  );

  const checkout = useCheckoutForm({
    items,
    subtotal,
    locale,
    currency,
    rate,
    formatPrice,
    onOrderSuccess: (orderId) => {
      clearCart();
      router.push(`/${locale}/order-confirmed?id=${orderId}`);
    },
  });

  const [discount, setDiscount] = useState("");

  if (!checkout.hydrated) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* ── Top bar ── */}
      <header className="bg-white border-b border-zinc-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
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

          {logoUrl ? (
            <Link href={`/${locale}`} className="flex items-center">
              <Image
                src={logoUrl}
                alt="LaCérémonie"
                width={140}
                height={35}
                className="h-5 w-auto object-contain"
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
                          <span className="text-sm font-bold text-zinc-900">
                            {formatPrice(price * item.quantity)}
                          </span>
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
              <div className="flex items-center gap-4 py-6">
                <input
                  type="text"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder={tCheckout.discount_placeholder ?? "Discount code"}
                  className="flex-1 rounded border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                />
                <button
                  type="button"
                  className="text-sm font-semibold text-zinc-900 hover:text-zinc-600 transition-colors"
                >
                  {tCheckout.apply ?? "Apply"}
                </button>
              </div>

              <div className="border-t border-zinc-100" />

              {/* Totals */}
              <div className="py-6 space-y-4">
                <div className="flex justify-between text-sm text-zinc-700">
                  <span>{tCheckout.subtotal ?? "Subtotal"}</span>
                  <span className="font-medium text-zinc-900">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-zinc-700 items-center">
                  <span>{tCheckout.total ?? "Total"}</span>
                  <span className="text-xl font-bold text-zinc-900">{formatPrice(subtotal)}</span>
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
