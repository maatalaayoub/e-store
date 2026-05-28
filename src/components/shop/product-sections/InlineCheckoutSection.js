"use client";

/**
 * Inline checkout section — renders a full checkout form on the product
 * page itself so customers can buy without navigating away.
 *
 * Reuses the shared `useCheckoutForm` hook + `CheckoutFields` /
 * `CheckoutActions` components, so this stays in lockstep with the main
 * checkout page.
 */

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { parsePrice } from "@/lib/price";
import { resolveProductTranslation } from "@/lib/product-locale";
import { useCheckoutForm } from "@/components/shop/checkout/useCheckoutForm";
import CheckoutFields from "@/components/shop/checkout/CheckoutFields";
import CheckoutActions from "@/components/shop/checkout/CheckoutActions";
import { ALL_FIELDS } from "@/components/shop/checkout/constants";
import { useProductQtyStore } from "@/store/useProductQtyStore";

export default function InlineCheckoutSection({ section, product, locale, dict, compact = false }) {
  const router = useRouter();
  const { formatPrice, currency, rate } = useCurrency();
  const tCheckout = dict?.checkout ?? {};
  const tProduct = dict?.product ?? {};

  const cfg = section?.config ?? {};
  const content = section?.content ?? {};
  const visibleFields = Array.isArray(cfg.fields) && cfg.fields.length > 0 ? cfg.fields : ALL_FIELDS;
  const fieldOrder = visibleFields;
  const showCoupon = cfg.show_coupon !== false;
  const showPlaceOrder = cfg.show_place_order !== false;
  const showWhatsApp = cfg.show_whatsapp !== false;
  const whatsappCountries = Array.isArray(cfg.whatsapp_countries)
    ? cfg.whatsapp_countries
    : null;
  const showSummary = cfg.show_summary !== false;

  const qty = useProductQtyStore((s) => s.getQty(product?.id));
  const isOutOfStock = (product?.stock ?? 0) <= 0;

  // ── Build the order line item from the current product ───────────────────
  const items = useMemo(() => {
    if (!product?.id) return [];
    return [
      {
        id: product.id,
        quantity: qty,
        price: product.price,
        effective_price: product.effective_price ?? product.price,
        name: product.name,
        translations: product.translations,
        images: product.images,
        stock: product.stock,
      },
    ];
  }, [product, qty]);

  const subtotal = items.reduce(
    (acc, it) => acc + parsePrice(it.effective_price ?? it.price) * it.quantity,
    0,
  );

  // Required fields = visible fields minus optional ones (state).
  const requiredFields = useMemo(
    () => visibleFields.filter((f) => f !== "state"),
    [visibleFields],
  );

  const checkout = useCheckoutForm({
    items,
    subtotal,
    locale,
    currency,
    rate,
    formatPrice,
    requiredFields,
    onOrderSuccess: (orderId) => {
      router.push(`/${locale}/order-confirmed?id=${orderId}`);
    },
  });

  const [discount, setDiscount] = useState("");

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
          {showSummary && (
            <div className="rounded-xl border border-zinc-200 overflow-hidden">
              <div className="flex items-center gap-3 p-3 bg-white">
                <div className="h-14 w-14 relative shrink-0 rounded-lg overflow-hidden border border-zinc-200 bg-white">
                  <Image src={img} alt={resolved.name} fill sizes="56px" className="object-cover" />
                </div>
                <div className="flex flex-1 flex-col min-w-0">
                  <span className="text-sm font-semibold text-zinc-900 truncate">{resolved.name}</span>
                  <span className="text-sm font-bold text-zinc-900">
                    {formatPrice(subtotal)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {showCoupon && (
            <div className="mt-4 flex items-center gap-3">
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
          )}

          <div className="mt-4 border-t border-zinc-100 pt-4 space-y-2">
            <div className="flex justify-between text-sm text-zinc-700">
              <span>{tCheckout.subtotal ?? "Subtotal"}</span>
              <span className="font-medium text-zinc-900">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-zinc-700 items-center">
              <span>{tCheckout.total ?? "Total"}</span>
              <span className="text-lg font-bold text-zinc-900">{formatPrice(subtotal)}</span>
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
              errors={checkout.errors}
              form={checkout.form}
              requiredFields={requiredFields}
              itemsCount={isOutOfStock ? 0 : items.length}
              country={checkout.form.country}
              showPlaceOrder={showPlaceOrder}
              showWhatsApp={showWhatsApp}
              whatsAppCountriesOnly={whatsappCountries}
              onPlaceOrder={isOutOfStock ? undefined : checkout.handlePlaceOrder}
              onOrderWhatsApp={isOutOfStock ? undefined : checkout.handleOrderWhatsApp}
              orderBtnStyle={Object.keys(orderBtnStyle).length ? orderBtnStyle : undefined}
              waBtnStyle={Object.keys(waBtnStyle).length ? waBtnStyle : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
