"use client";

import { useState } from "react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { useCartStore } from "@/store/useCartStore";
import { resolveProductTranslation } from "@/lib/product-locale";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ShoppingCart, Check, Heart, ArrowUpRight } from "lucide-react";
import { useFavorite } from "@/hooks/useFavorite";

// Valid button style values — also used by admin UI and section config
export const BUTTON_STYLES = {
  ADD_TO_CART:  'add_to_cart',        // single "Add to Cart" button (default)
  SHOP_NOW:     'shop_now',            // single "Shop Now" link
  HORIZONTAL_1: 'horizontal_style1',  // "Shop Now" text + icon-only cart button side-by-side
  HORIZONTAL_2: 'horizontal_style2',  // "Shop Now" + "Add to Cart" text, equal halves
  VERTICAL:     'vertical',            // "Shop Now" top + "Add to Cart" bottom stacked
};

// Card layout presets — controls overall structure (where info sits, borders, shadows)
export const CARD_LAYOUTS = {
  OVERLAY:  'overlay',   // Info overlaid on the image bottom
  CLASSIC:  'classic',   // Info centered below image
  MINIMAL:  'minimal',   // Info left-aligned below image, smaller text
  BORDERED: 'bordered',  // Bordered card with internal padding
  SHADOW:   'shadow',    // Soft-shadow card with internal padding
  SHOWCASE: 'showcase',  // Premium boutique style — favorite + arrow CTA
  BOUTIQUE: 'boutique',  // Bordered card with brand, title, price, full-width pill CTA
};

export default function ProductCard({ product: rawProduct, onAdded, buttonStyle, filledBg, filledText, outlineBorder, outlineText, outlineIcon, outlineBg, buttonFontSize, layout }) {
  const dict = useDictionary();
  const { locale } = useParams();
  const tHome = dict?.home ?? {};
  const { addItem } = useCartStore();
  const { formatPrice } = useCurrency();
  const [added, setAdded] = useState(false);
  const { isFavorited, toggle: toggleFav } = useFavorite(rawProduct?.id);

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
  const btnBase    = "transition-all duration-300 active:scale-[0.98] font-bold uppercase tracking-[0.1em] rounded-[2px] py-3 sm:py-3.5";
  const btnOutline = `${btnBase} border pcard-btn-outline`;
  const btnFilled  = `${btnBase} pcard-btn-filled`;
  // Added-to-cart feedback state (always green — not colour-overridable)
  const btnAdded   = `${btnBase} border border-green-500 bg-green-500 text-white scale-[1.04]`;

  // ── Layout preset ──────────────────────────────────────────────
  const cardLayout = layout ?? CARD_LAYOUTS.OVERLAY;

  const articleClass = {
    [CARD_LAYOUTS.OVERLAY]:  "group flex flex-col h-full rounded-[5px] overflow-hidden pb-1",
    [CARD_LAYOUTS.CLASSIC]:  "group flex flex-col h-full",
    [CARD_LAYOUTS.MINIMAL]:  "group flex flex-col h-full",
    [CARD_LAYOUTS.BORDERED]: "group flex flex-col h-full rounded-[6px] border border-zinc-200 overflow-hidden p-3 sm:p-4 hover:border-zinc-400 transition-colors duration-300 bg-white",
    [CARD_LAYOUTS.SHADOW]:   "group flex flex-col h-full rounded-[8px] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow duration-300 p-3 sm:p-4 overflow-hidden",
    [CARD_LAYOUTS.SHOWCASE]: "group flex flex-col h-full rounded-[18px] bg-zinc-50 hover:bg-zinc-100/80 transition-colors duration-300 p-2 sm:p-2.5 overflow-hidden",
    [CARD_LAYOUTS.BOUTIQUE]: "group flex flex-col h-full rounded-[20px] border border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-300 p-3 sm:p-4 overflow-hidden",
  }[cardLayout];

  const imgWrapperClass = cardLayout === CARD_LAYOUTS.BORDERED || cardLayout === CARD_LAYOUTS.SHADOW
    ? "relative aspect-square w-full overflow-hidden bg-[#ebebeb] block rounded-[4px]"
    : cardLayout === CARD_LAYOUTS.SHOWCASE
    ? "relative aspect-square w-full overflow-hidden bg-[#ebebeb] block rounded-[14px]"
    : cardLayout === CARD_LAYOUTS.BOUTIQUE
    ? "relative aspect-square w-full overflow-hidden bg-zinc-100 block rounded-[14px]"
    : "relative aspect-square w-full overflow-hidden bg-[#ebebeb] block";

  const showOverlayInfo = cardLayout === CARD_LAYOUTS.OVERLAY;
  const isShowcase      = cardLayout === CARD_LAYOUTS.SHOWCASE;
  const isBoutique      = cardLayout === CARD_LAYOUTS.BOUTIQUE;
  const showInfoBelow   = !showOverlayInfo && !isShowcase && !isBoutique;

  // Buttons block — re-used across layouts
  const ButtonsBlock = (
    <div>
      {style === BUTTON_STYLES.ADD_TO_CART && (
        <button onClick={handleAdd} className={`w-full ${added ? btnAdded : btnOutline}`}>
          {added ? <Check className="h-4 w-4 mx-auto" /> : tHome.buy_now}
        </button>
      )}

      {style === BUTTON_STYLES.SHOP_NOW && (
        <Link href={`/${locale}/product/${product.id}`} className={`flex items-center justify-center w-full ${btnFilled}`}>
          {tHome.shop_now}
        </Link>
      )}

      {style === BUTTON_STYLES.HORIZONTAL_1 && (
        <div className="flex gap-2">
          <Link href={`/${locale}/product/${product.id}`} className={`flex-1 flex items-center justify-center ${btnFilled}`}>
            {tHome.shop_now}
          </Link>
          <button
            onClick={handleAdd}
            aria-label={tHome.buy_now}
            className={`flex-none flex items-center justify-center w-11 sm:w-12 rounded-[2px] transition-all duration-300 active:scale-[0.98] border ${
              added ? "border-green-500 bg-green-500 text-white scale-[1.04]" : "pcard-btn-outline"
            }`}
          >
            {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          </button>
        </div>
      )}

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
  );

  // Info block — text + price (rendered below image except in overlay layout)
  const isMinimal = cardLayout === CARD_LAYOUTS.MINIMAL;
  const InfoBlock = (
    <div className={`flex flex-col ${isMinimal ? 'text-start' : 'text-center'} pt-3 pb-3`}>
      <Link href={`/${locale}/product/${product.id}`}>
        <h3 className={`line-clamp-2 text-zinc-900 leading-snug hover:text-blue-600 transition-colors ${isArabicName ? "text-sm sm:text-base font-semibold tracking-normal font-[family-name:var(--font-cairo)]" : isMinimal ? "text-xs sm:text-sm font-semibold uppercase tracking-[0.1em]" : "text-xs sm:text-sm font-bold uppercase tracking-[0.15em] sm:tracking-[0.18em]"}`}>
          {product.name}
        </h3>
      </Link>
      <div className={`mt-2 flex items-center gap-2 ${isMinimal ? 'justify-start' : 'justify-center'}`}>
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
    </div>
  );

  return (
    <article
      className={articleClass}
      style={{
        '--pcard-filled-bg':       filledBg       ?? '#18181b',
        '--pcard-filled-text':     filledText     ?? '#ffffff',
        '--pcard-outline-border':  outlineBorder  ?? '#18181b',
        '--pcard-outline-text':    outlineText    ?? '#18181b',
        '--pcard-outline-icon':    outlineIcon    ?? '#18181b',
        '--pcard-outline-bg':      outlineBg      ?? 'transparent',
        '--pcard-btn-font-size':   buttonFontSize ? `${buttonFontSize}px` : '10px',
      }}
    >
      <Link href={`/${locale}/product/${product.id}`} className={imgWrapperClass}>
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

        {badge && !isBoutique && (
          <span
            dir="ltr"
            className="absolute left-3 top-3 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-900 shadow-sm z-10"
          >
            {badge}
          </span>
        )}

        {/* Boutique: pill badge + favorite + dots */}
        {isBoutique && (
          <>
            {(badge || product.is_featured) && (
              <span
                dir="ltr"
                className="absolute left-3 top-3 z-10 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-sm"
              >
                {badge ?? 'Best Seller'}
              </span>
            )}
            <button
              type="button"
              onClick={toggleFav}
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm hover:scale-105 transition-transform duration-200"
            >
              <Heart
                className={`h-[16px] w-[16px] transition-all ${isFavorited ? 'fill-red-500 text-red-500' : 'fill-red-500 text-red-500'}`}
                strokeWidth={2}
              />
            </button>
            <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-1.5 pointer-events-none">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
            </div>
          </>
        )}

        {/* Showcase: favorite + decorative dots */}
        {isShowcase && (
          <>
            <button
              type="button"
              onClick={toggleFav}
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/70 backdrop-blur-sm text-zinc-900 hover:bg-white transition-colors duration-200"
            >
              <Heart
                className={`h-[18px] w-[18px] transition-all ${isFavorited ? 'fill-red-500 text-red-500' : 'fill-transparent'}`}
                strokeWidth={2}
              />
            </button>
            <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-1.5 pointer-events-none">
              <span className="h-1.5 w-1.5 rounded-full bg-white/90 shadow-sm" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
            </div>
          </>
        )}

        {/* Overlay info — only for OVERLAY preset */}
        {showOverlayInfo && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-3 pt-8 pb-3">
            <h3 className={`line-clamp-1 text-white leading-snug drop-shadow ${isArabicName ? "text-sm font-semibold tracking-normal font-[family-name:var(--font-cairo)]" : "text-[11px] font-bold uppercase tracking-[0.15em]"}`}>
              {product.name}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              {hasDiscount ? (
                <>
                  <span className="text-xs font-semibold tracking-widest text-white uppercase drop-shadow">
                    {fmt(effectivePrice)}
                  </span>
                  <span className="text-[10px] tracking-widest text-white/60 line-through uppercase">
                    {fmt(originalPrice)}
                  </span>
                </>
              ) : (
                <span className="text-xs tracking-widest text-white/80 uppercase drop-shadow">
                  {fmt(originalPrice)}
                </span>
              )}
            </div>
          </div>
        )}
      </Link>

      {showInfoBelow && InfoBlock}

      {isShowcase && (
        <div className="flex items-end justify-between gap-3 px-2 sm:px-3 pt-3 pb-2">
          <Link href={`/${locale}/product/${product.id}`} className="min-w-0 flex-1">
            <h3 className={`truncate text-zinc-900 leading-snug hover:text-zinc-600 transition-colors ${isArabicName ? "text-sm sm:text-base font-semibold font-[family-name:var(--font-cairo)]" : "text-[13px] sm:text-[15px] font-semibold tracking-tight"}`}>
              {product.name}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              {hasDiscount ? (
                <>
                  <span className="text-base sm:text-lg font-bold text-zinc-900">{fmt(effectivePrice)}</span>
                  <span className="text-xs text-zinc-400 line-through">{fmt(originalPrice)}</span>
                </>
              ) : (
                <span className="text-base sm:text-lg font-bold text-zinc-900">{fmt(originalPrice)}</span>
              )}
            </div>
          </Link>
          <Link
            href={`/${locale}/product/${product.id}`}
            aria-label={tHome.shop_now ?? 'View product'}
            className="flex-none flex items-center justify-center h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-white text-zinc-900 hover:bg-zinc-900 hover:text-white transition-all duration-300 group-hover:rotate-12"
          >
            <ArrowUpRight className="h-5 w-5" strokeWidth={2} />
          </Link>
        </div>
      )}

      {!isShowcase && !isBoutique && (
        <div className="mt-auto pt-1">
          {ButtonsBlock}
        </div>
      )}

      {isBoutique && (
        <div className="flex flex-col px-1 pt-4 pb-1 gap-1">
          {(product.category?.name || product.category_name) && (
            <span className="text-[13px] font-medium text-emerald-600">
              {product.category?.name ?? product.category_name}
            </span>
          )}
          <Link href={`/${locale}/product/${product.id}`}>
            <h3 className={`line-clamp-2 text-zinc-900 leading-snug hover:text-zinc-600 transition-colors ${isArabicName ? "text-base sm:text-lg font-bold font-[family-name:var(--font-cairo)]" : "text-[15px] sm:text-[17px] font-bold tracking-tight"}`}>
              {product.name}
            </h3>
          </Link>
          <div className="flex items-center gap-2">
            {hasDiscount ? (
              <>
                <span className="text-[15px] sm:text-[17px] font-semibold text-zinc-900">{fmt(effectivePrice)}</span>
                <span className="text-xs text-zinc-400 line-through">{fmt(originalPrice)}</span>
              </>
            ) : (
              <span className="text-[15px] sm:text-[17px] font-semibold text-zinc-900">{fmt(originalPrice)}</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className={`mt-3 w-full rounded-full py-3.5 text-sm font-medium transition-all duration-300 active:scale-[0.98] ${
              added
                ? 'bg-green-500 text-white'
                : 'bg-zinc-900 text-white hover:bg-zinc-800'
            }`}
          >
            {added ? <Check className="h-4 w-4 mx-auto" /> : (tHome.buy_now ?? 'Buy Now')}
          </button>
        </div>
      )}
    </article>
  );
}

