"use client";

import { useState } from "react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { useCartStore } from "@/store/useCartStore";
import { resolveProductTranslation } from "@/lib/product-locale";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ShoppingCart, Check } from "lucide-react";

// Valid button style values — also used by admin UI and section config
export const BUTTON_STYLES = {
  ADD_TO_CART:  'add_to_cart',        // single "Add to Cart" button (default)
  SHOP_NOW:     'shop_now',            // single "Shop Now" link
  HORIZONTAL_1: 'horizontal_style1',  // "Shop Now" text + icon-only cart button side-by-side
  HORIZONTAL_2: 'horizontal_style2',  // "Shop Now" + "Add to Cart" text, equal halves
  VERTICAL:     'vertical',            // "Shop Now" top + "Add to Cart" bottom stacked
};

export default function ProductCard({ product: rawProduct, onAdded, buttonStyle, filledBg, filledText, outlineBorder, outlineText, outlineIcon, outlineBg }) {
  const dict = useDictionary();
  const { locale } = useParams();
  const tHome = dict?.home ?? {};
  const { addItem } = useCartStore();
  const { formatPrice } = useCurrency();
  const [added, setAdded] = useState(false);

  const product = resolveProductTranslation(rawProduct, locale);

  const handleAdd = () => {
    addItem(product);
    onAdded?.();
    setAdded(true);
    setTimeout(() => setAdded(false), 900);
  };

  const isArabicName = /[\u0600-\u06FF]/.test(product.name ?? "");

  // Resolve discount — prices are stored in MAD
  let effectivePrice = product.effective_price ?? product.price;
  const originalPrice = product.price;
  const hasDiscount =
    effectivePrice != null &&
    originalPrice != null &&
    Number(String(effectivePrice).replace(/[^0-9.]/g, '')) <
    Number(String(originalPrice).replace(/[^0-9.]/g, ''));

  const fmt = (n) => formatPrice(n);

  // Image: prefer main_image, fallback to image, then null
  const imgSrc = product.main_image ?? product.image ?? null;

  // Badge: explicit badge > computed discount badge
  const badge = product.badge ?? null;

  const style = buttonStyle ?? BUTTON_STYLES.ADD_TO_CART;

  // Shared button class fragments (colours driven by CSS custom properties set on <article>)
  const btnBase    = "transition-all duration-300 active:scale-[0.98] font-bold uppercase tracking-[0.1em] text-[10px] sm:text-xs rounded-[5px] py-3 sm:py-3.5";
  const btnOutline = `${btnBase} border pcard-btn-outline`;
  const btnFilled  = `${btnBase} pcard-btn-filled`;
  // Added-to-cart feedback state (always green — not colour-overridable)
  const btnAdded   = `${btnBase} border border-green-500 bg-green-500 text-white scale-[1.04]`;

  return (
    <article
      className="group flex flex-col h-full"
      style={{
        '--pcard-filled-bg':      filledBg      ?? '#18181b',
        '--pcard-filled-text':    filledText    ?? '#ffffff',
        '--pcard-outline-border': outlineBorder ?? '#18181b',
        '--pcard-outline-text':   outlineText   ?? '#18181b',
        '--pcard-outline-icon':   outlineIcon   ?? '#18181b',
        '--pcard-outline-bg':     outlineBg     ?? 'transparent',
      }}
    >
      <Link href={`/${locale}/product/${product.id}`} className="relative aspect-square w-full overflow-hidden bg-[#ebebeb] block rounded-[5px]">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-zinc-100" />
        )}

        {badge && (
          <span
            dir="ltr"
            className="absolute left-3 top-3 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-900 shadow-sm z-10"
          >
            {badge}
          </span>
        )}
      </Link>

      <div className="mt-4 sm:mt-5 flex flex-1 flex-col text-center">
        <Link href={`/${locale}/product/${product.id}`}>
          <h3 className={`line-clamp-2 text-zinc-900 leading-snug hover:text-blue-600 transition-colors ${isArabicName ? "text-sm sm:text-base font-semibold tracking-normal font-[family-name:var(--font-cairo)]" : "text-xs sm:text-sm font-bold uppercase tracking-[0.15em] sm:tracking-[0.18em]"}`}>
            {product.name}
          </h3>
        </Link>

        {/* Price row */}
        <div className="mt-2 flex items-center justify-center gap-2">
          {hasDiscount ? (
            <>
              <span className="text-sm sm:text-base font-semibold tracking-widest text-zinc-900 uppercase">
                {fmt(effectivePrice)}
              </span>
              <span className="text-xs tracking-widest text-zinc-400 line-through uppercase">
                {fmt(originalPrice)}
              </span>
            </>
          ) : (
            <span className="text-sm sm:text-base tracking-widest text-zinc-500 uppercase">
              {fmt(originalPrice)}
            </span>
          )}
        </div>

        {/* ── Button area ────────────────────────────────────────── */}
        <div className="mt-auto pt-4">

          {/* Style 1: single Add to Cart (default) */}
          {style === BUTTON_STYLES.ADD_TO_CART && (
            <button onClick={handleAdd} className={`w-full ${added ? btnAdded : btnOutline}`}>
              {added ? <Check className="h-4 w-4 mx-auto" /> : tHome.buy_now}
            </button>
          )}

          {/* Style 2: single Shop Now link */}
          {style === BUTTON_STYLES.SHOP_NOW && (
            <Link href={`/${locale}/product/${product.id}`} className={`flex items-center justify-center w-full ${btnFilled}`}>
              {tHome.shop_now}
            </Link>
          )}

          {/* Style 3: horizontal — "Shop Now" text + icon-only cart button */}
          {style === BUTTON_STYLES.HORIZONTAL_1 && (
            <div className="flex gap-2">
              <Link href={`/${locale}/product/${product.id}`} className={`flex-1 flex items-center justify-center ${btnFilled}`}>
                {tHome.shop_now}
              </Link>
              <button
                onClick={handleAdd}
                aria-label={tHome.buy_now}
                className={`flex-none flex items-center justify-center w-11 sm:w-12 rounded-[5px] transition-all duration-300 active:scale-[0.98] border ${
                  added
                    ? "border-green-500 bg-green-500 text-white scale-[1.04]"
                    : "pcard-btn-outline"
                }`}
              >
                {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
              </button>
            </div>
          )}

          {/* Style 4: horizontal — "Shop Now" + "Add to Cart" equal halves */}
          {style === BUTTON_STYLES.HORIZONTAL_2 && (
            <div className="flex gap-2">
              <Link href={`/${locale}/product/${product.id}`} className={`flex-1 flex items-center justify-center ${btnFilled}`}>
                {tHome.shop_now}
              </Link>
              <button onClick={handleAdd} className={`flex-1 ${added ? btnAdded : btnOutline}`}>
                {added ? <Check className="h-4 w-4 mx-auto" /> : tHome.buy_now}
              </button>
            </div>
          )}

          {/* Style 5: vertical — "Shop Now" top + "Add to Cart" bottom */}
          {style === BUTTON_STYLES.VERTICAL && (
            <div className="flex flex-col gap-2">
              <Link href={`/${locale}/product/${product.id}`} className={`w-full flex items-center justify-center ${btnFilled}`}>
                {tHome.shop_now}
              </Link>
              <button onClick={handleAdd} className={`w-full ${added ? btnAdded : btnOutline}`}>
                {added ? <Check className="h-4 w-4 mx-auto" /> : tHome.buy_now}
              </button>
            </div>
          )}

        </div>
      </div>
    </article>
  );
}

