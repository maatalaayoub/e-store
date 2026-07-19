"use client";

import { useMemo, useState } from "react";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { useCartStore } from "@/store/useCartStore";
import { resolveProductTranslation } from "@/lib/product-locale";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ShoppingCart, Check, Heart, ArrowUpRight, Star } from "lucide-react";
import { useFavorite } from "@/hooks/useFavorite";
import VariantPickerModal from "@/components/shop/VariantPickerModal";

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
  FLOATING: 'floating',  // Edge-to-edge image with circular discount badge + floating pill (cart + favorite) overlay
  RETAIL:   'retail',    // iHerb-style compact card — contained image, category, name, rating, price, orange Add button
};

export default function ProductCard({ product: rawProduct, onAdded, buttonStyle, filledBg, filledText, outlineBorder, outlineText, outlineIcon, outlineBg, buttonFontSize, layout, showShortDescription, hideButtons }) {
  const dict = useDictionary();
  const { locale } = useParams();
  const tHome = dict?.home ?? {};
  const tProduct = dict?.product ?? {};
  const { addItem } = useCartStore();
  const { formatPrice } = useCurrency();
  const [added, setAdded] = useState(false);
  const { isFavorited, toggle: toggleFav } = useFavorite(rawProduct?.id);

  const product = resolveProductTranslation(rawProduct, locale);
  const isOutOfStock = Number(product?.stock ?? 0) <= 0;
  const outOfStockText = tHome.out_of_stock ?? tProduct.out_of_stock ?? "Out of stock";
  const shortDescription = product.short_description?.trim();
  const shouldShowShortDescription = showShortDescription === true && Boolean(shortDescription);

  // ── Variant detection ────────────────────────────────────────────────
  const colors = useMemo(
    () =>
      Array.isArray(rawProduct?.colors)
        ? rawProduct.colors.filter((c) => c && c.name && c.hex)
        : [],
    [rawProduct?.colors],
  );
  const sizes = useMemo(
    () => (Array.isArray(rawProduct?.sizes) ? rawProduct.sizes.filter(Boolean) : []),
    [rawProduct?.sizes],
  );
  const hasVariants = colors.length > 0 || sizes.length > 0;
  const [variantOpen, setVariantOpen] = useState(false);

  const commitAdd = ({ selectedColor = null, selectedSize = null } = {}) => {
    if (isOutOfStock) return;
    addItem(product, { quantity: 1, selectedColor, selectedSize });
    onAdded?.();
    setAdded(true);
    setTimeout(() => setAdded(false), 900);
  };

  const handleAdd = () => {
    if (isOutOfStock) return;
    if (hasVariants) {
      setVariantOpen(true);
      return;
    }
    commitAdd();
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
  const btnBase    = "flex h-full min-w-0 items-center justify-center px-2 text-center leading-none transition-all duration-300 active:scale-[0.98] font-bold uppercase tracking-[0.1em] rounded-[7px]";
  const btnOutline = `${btnBase} border pcard-btn-outline`;
  const btnFilled  = `${btnBase} pcard-btn-filled`;
  // Added-to-cart feedback state (always green — not colour-overridable)
  const btnAdded   = `${btnBase} border border-green-500 bg-green-500 text-white scale-[1.04]`;
  const btnDisabled = `${btnBase} border border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed`;
  const actionSlotClass = style === BUTTON_STYLES.VERTICAL
    ? "mt-auto h-[104px] pt-1 sm:h-[112px]"
    : "mt-auto h-12 pt-1 sm:h-[52px]";

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
    [CARD_LAYOUTS.FLOATING]: "group flex flex-col h-full",
    [CARD_LAYOUTS.RETAIL]:   "group flex h-full flex-col bg-white rounded-[12px] overflow-hidden border border-zinc-100",
  }[cardLayout];

  const imgWrapperClass = cardLayout === CARD_LAYOUTS.BORDERED || cardLayout === CARD_LAYOUTS.SHADOW
    ? "relative aspect-square w-full overflow-hidden bg-[#ebebeb] block rounded-[4px]"
    : cardLayout === CARD_LAYOUTS.SHOWCASE
    ? "relative aspect-square w-full overflow-hidden bg-[#ebebeb] block rounded-[14px]"
    : cardLayout === CARD_LAYOUTS.BOUTIQUE
    ? "relative aspect-square w-full overflow-hidden bg-zinc-100 block rounded-[14px]"
    : cardLayout === CARD_LAYOUTS.FLOATING
    ? "relative aspect-[4/5] w-full overflow-hidden bg-white block"
    : cardLayout === CARD_LAYOUTS.RETAIL
    ? "relative aspect-square w-full overflow-hidden bg-[#f5f5f5] block"
    : "relative aspect-square w-full overflow-hidden bg-[#ebebeb] block";

  const showOverlayInfo = cardLayout === CARD_LAYOUTS.OVERLAY;
  const isShowcase      = cardLayout === CARD_LAYOUTS.SHOWCASE;
  const isBoutique      = cardLayout === CARD_LAYOUTS.BOUTIQUE;
  const isFloating      = cardLayout === CARD_LAYOUTS.FLOATING;
  const isRetail        = cardLayout === CARD_LAYOUTS.RETAIL;
  const showInfoBelow   = !showOverlayInfo && !isShowcase && !isBoutique && !isFloating && !isRetail;

  // Rating (used by RETAIL layout)
  const ratingValue = Number(product.rating ?? product.average_rating ?? product.reviews_average ?? 0);
  const ratingCount = Number(product.rating_count ?? product.review_count ?? product.reviews_count ?? 0);
  const hasRating   = ratingValue > 0;

  // Discount percentage (used by FLOATING badge)
  const discountPercent = hasDiscount
    ? Math.round(
        ((Number(String(originalPrice).replace(/[^0-9.]/g, '')) -
          Number(String(effectivePrice).replace(/[^0-9.]/g, ''))) /
          Number(String(originalPrice).replace(/[^0-9.]/g, ''))) * 100
      )
    : 0;

  // Buttons block — re-used across layouts
  const ButtonsBlock = (
    <div className="h-full">
      {style === BUTTON_STYLES.ADD_TO_CART && (
        <button data-no-global-progress="true" onClick={handleAdd} disabled={isOutOfStock} className={`w-full ${isOutOfStock ? btnDisabled : added ? btnAdded : btnOutline}`}>
          {isOutOfStock ? outOfStockText : added ? <Check className="h-4 w-4 mx-auto" /> : tHome.buy_now}
        </button>
      )}

      {style === BUTTON_STYLES.SHOP_NOW && (
        <Link href={`/${locale}/product/${product.id}`} className={`flex items-center justify-center w-full ${btnFilled}`}>
          {tHome.shop_now}
        </Link>
      )}

      {style === BUTTON_STYLES.HORIZONTAL_1 && (
        <div className="flex h-full gap-2">
          <Link href={`/${locale}/product/${product.id}`} className={`flex-1 flex items-center justify-center ${btnFilled}`}>
            {tHome.shop_now}
          </Link>
          <button
            data-no-global-progress="true"
            onClick={handleAdd}
            disabled={isOutOfStock}
            aria-label={isOutOfStock ? outOfStockText : tHome.buy_now}
            className={`flex-none flex h-full items-center justify-center w-11 sm:w-12 rounded-[7px] transition-all duration-300 active:scale-[0.98] border ${
              isOutOfStock ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400" : added ? "border-green-500 bg-green-500 text-white scale-[1.04]" : "pcard-btn-outline"
            }`}
          >
            {added && !isOutOfStock ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          </button>
        </div>
      )}

      {style === BUTTON_STYLES.HORIZONTAL_2 && (
        <div className="flex h-full gap-2">
          <Link href={`/${locale}/product/${product.id}`} className={`flex-1 flex items-center justify-center ${btnFilled}`}>
            {tHome.shop_now}
          </Link>
          <button data-no-global-progress="true" onClick={handleAdd} disabled={isOutOfStock} className={`flex-1 ${isOutOfStock ? btnDisabled : added ? btnAdded : btnOutline}`}>
            {isOutOfStock ? outOfStockText : added ? <Check className="h-4 w-4 mx-auto" /> : tHome.buy_now}
          </button>
        </div>
      )}

      {style === BUTTON_STYLES.VERTICAL && (
        <div className="flex h-full flex-col gap-2">
          <Link href={`/${locale}/product/${product.id}`} className={`w-full flex-1 ${btnFilled} h-auto`}>
            {tHome.shop_now}
          </Link>
          <button data-no-global-progress="true" onClick={handleAdd} disabled={isOutOfStock} className={`w-full flex-1 ${isOutOfStock ? btnDisabled : added ? btnAdded : btnOutline} h-auto`}>
            {isOutOfStock ? outOfStockText : added ? <Check className="h-4 w-4 mx-auto" /> : tHome.buy_now}
          </button>
        </div>
      )}
    </div>
  );

  // Info block — text + price (rendered below image except in overlay layout)
  const isMinimal = cardLayout === CARD_LAYOUTS.MINIMAL;
  const InfoBlock = (
    <div className={`flex ${shouldShowShortDescription ? 'h-[136px] sm:h-[142px]' : 'h-[104px] sm:h-[108px]'} flex-col overflow-hidden ${isMinimal ? 'text-start' : 'text-center'} pt-3 pb-3`}>
      <Link href={`/${locale}/product/${product.id}`}>
        <h3 className={`line-clamp-2 h-[2.75em] text-zinc-900 leading-snug hover:text-blue-600 transition-colors ${isArabicName ? "text-sm sm:text-base font-semibold tracking-normal font-[family-name:var(--font-cairo)]" : isMinimal ? "text-xs sm:text-sm font-semibold uppercase tracking-[0.1em]" : "text-xs sm:text-sm font-bold uppercase tracking-[0.15em] sm:tracking-[0.18em]"}`}>
          {product.name}
        </h3>
      </Link>
      {shouldShowShortDescription && (
        <p className="mt-1 line-clamp-2 min-h-[2.5em] text-xs leading-snug text-zinc-500">
          {shortDescription}
        </p>
      )}
      <div className={`mt-auto flex min-h-6 items-center gap-2 ${isMinimal ? 'justify-start' : 'justify-center'}`}>
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
          <Image
            src={imgSrc}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            loading="lazy"
            className={`transition-transform duration-700 ease-out group-hover:scale-105 ${isRetail ? 'object-contain p-3 sm:p-4' : isFloating ? 'object-contain p-3' : 'object-cover'}`}
          />
        ) : (
          <div className="h-full w-full bg-zinc-100" />
        )}

        {badge && !isBoutique && !isFloating && !isRetail && !(showOverlayInfo && hasDiscount) && (
          <span
            dir="ltr"
            className="absolute left-3 top-3 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-900 shadow-sm z-10"
          >
            {badge}
          </span>
        )}

        {/* Overlay: discount badge — top-right */}
        {showOverlayInfo && hasDiscount && (
          <span
            dir="ltr"
            className="absolute right-2.5 top-2.5 z-10 rounded-[5px] bg-red-600 px-2 py-1 text-[10px] sm:text-[11px] font-bold text-white leading-none"
          >
            -{discountPercent}%
          </span>
        )}

        {isOutOfStock && (
          <div className={`absolute inset-x-3 z-20 flex justify-center ${isFloating ? 'bottom-14' : 'bottom-4'}`}>
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-600 [text-shadow:0_0_12px_rgba(255,255,255,1),0_0_6px_rgba(255,255,255,1),0_2px_8px_rgba(0,0,0,0.5)]">
              {outOfStockText}
            </span>
          </div>
        )}

        {/* Retail: discount badge */}
        {isRetail && hasDiscount && (
          <span
            dir="ltr"
            className="absolute left-2 top-2 z-10 rounded-[5px] bg-[#fff3dc] px-[7px] py-[3px] text-[10px] sm:text-[11px] font-semibold text-[#b45309]"
          >
            -{discountPercent}%
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
                {badge ?? (tHome.best_seller_label ?? 'Best Seller')}
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

        {/* Floating: circular discount badge + white pill (cart + favorite) */}
        {isFloating && (
          <>
            {hasDiscount && (
              <span
                dir="ltr"
                className="absolute left-3 top-3 z-10 rounded-[4px] bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white"
              >
                -{discountPercent}%
              </span>
            )}
            <div
              className="absolute left-1/2 bottom-3 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-white px-1.5 py-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.10)]"
              onClick={(e) => e.preventDefault()}
            >
              <button
                type="button"
                data-no-global-progress="true"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAdd(); }}
                disabled={isOutOfStock}
                aria-label={isOutOfStock ? outOfStockText : (tHome.buy_now ?? 'Add to cart')}
                className={`flex h-7 w-9 items-center justify-center rounded-full transition-colors ${isOutOfStock ? 'cursor-not-allowed text-zinc-300' : 'text-zinc-800 hover:bg-zinc-100'}`}
              >
                {added && !isOutOfStock ? <Check className="h-4 w-4 text-green-600" /> : <ShoppingCart className="h-4 w-4" strokeWidth={1.75} />}
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(); }}
                aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                className="flex h-7 w-9 items-center justify-center rounded-full text-zinc-800 hover:bg-zinc-100 transition-colors"
              >
                <Heart
                  className={`h-4 w-4 transition-all ${isFavorited ? 'fill-red-500 text-red-500' : 'fill-transparent'}`}
                  strokeWidth={1.75}
                />
              </button>
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
            {shouldShowShortDescription && (
              <p className="mt-1 line-clamp-1 text-[11px] leading-snug text-white/80 drop-shadow">
                {shortDescription}
              </p>
            )}
            <div className="mt-1.5 flex items-baseline gap-1.5">
              {hasDiscount ? (
                <>
                  <span className="text-sm font-bold text-white drop-shadow">
                    {fmt(effectivePrice)}
                  </span>
                  <span className="text-[10px] text-white/55 line-through leading-none">
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
        <div className={`flex ${shouldShowShortDescription ? 'h-[112px]' : 'h-[76px]'} items-end justify-between gap-3 overflow-hidden px-2 pt-3 pb-2 sm:px-3`}>
          <Link href={`/${locale}/product/${product.id}`} className="min-w-0 flex-1">
            <h3 className={`truncate text-zinc-900 leading-snug hover:text-zinc-600 transition-colors ${isArabicName ? "text-sm sm:text-base font-semibold font-[family-name:var(--font-cairo)]" : "text-[13px] sm:text-[15px] font-semibold tracking-tight"}`}>
              {product.name}
            </h3>
            {shouldShowShortDescription && (
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-zinc-500">
                {shortDescription}
              </p>
            )}
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

      {!isShowcase && !isBoutique && !isFloating && !isRetail && !hideButtons && (
        <div className={actionSlotClass}>
          {ButtonsBlock}
        </div>
      )}

      {isRetail && (
        <div className="flex flex-col gap-1.5 px-2.5 pt-2.5 pb-3 sm:px-3 sm:pt-3">
          {/* Category */}
          {(product.category?.name || product.category_name) && (
            <span className="text-[10px] sm:text-[11px] font-medium text-zinc-400 uppercase tracking-wider leading-none line-clamp-1">
              {product.category?.name ?? product.category_name}
            </span>
          )}
          {/* Product name */}
          <Link href={`/${locale}/product/${product.id}`}>
            <h3 className={`line-clamp-2 min-h-[2.5em] leading-snug text-zinc-800 hover:text-zinc-600 transition-colors ${isArabicName ? "text-[13px] sm:text-sm font-bold font-[family-name:var(--font-cairo)]" : "text-[12px] sm:text-[13px] font-bold"}`}>
              {product.name}
            </h3>
          </Link>
          {/* Short description */}
          {shouldShowShortDescription && (
            <p className="line-clamp-2 min-h-[2.5em] -mt-3 text-[10px] sm:text-[11px] leading-snug text-zinc-400">
              {shortDescription}
            </p>
          )}
          {/* Rating */}
          {hasRating && (
            <div className="flex items-center gap-1" dir="ltr">
              <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-amber-400 text-amber-400 flex-shrink-0" />
              <span className="text-[11px] sm:text-xs text-zinc-600 font-medium">{ratingValue.toFixed(1)}</span>
              {ratingCount > 0 && (
                <span className="text-[11px] sm:text-xs text-teal-600">({ratingCount.toLocaleString()})</span>
              )}
            </div>
          )}
          {/* Price */}
          <div className="mt-auto flex items-baseline gap-1.5" dir="ltr">
            {hasDiscount ? (
              <>
                <span className="text-[13px] sm:text-[14px] font-bold text-red-600 leading-none">{fmt(effectivePrice)}</span>
                <span className="text-[11px] text-zinc-400 line-through leading-none">{fmt(originalPrice)}</span>
              </>
            ) : (
              <span className="text-[13px] sm:text-[14px] font-bold text-zinc-900 leading-none">{fmt(originalPrice)}</span>
            )}
          </div>
          {/* Add button */}
          <button
            type="button"
            data-no-global-progress="true"
            onClick={handleAdd}
            disabled={isOutOfStock}
            className={`mt-4 inline-flex w-fit items-center gap-1.5 rounded-[8px] px-3 sm:px-3.5 py-2 text-[11px] sm:text-xs font-semibold transition-all duration-200 active:scale-[0.97] ${
              isOutOfStock
                ? 'cursor-not-allowed bg-zinc-100 text-zinc-400'
                : added
                ? 'bg-green-500 text-white border-green-500 border'
                : 'border pcard-btn-outline'
            }`}
          >
            {isOutOfStock ? (
              <span className="line-clamp-1">{outOfStockText}</span>
            ) : added ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <>
                <ShoppingCart className="h-3.5 w-3.5 flex-shrink-0" />
                {tHome.add ?? 'Add'}
              </>
            )}
          </button>
        </div>
      )}

      {isFloating && (
        <div className="flex flex-col items-center gap-1 px-2 pt-5 pb-3 text-center">
          <Link href={`/${locale}/product/${product.id}`}>
            <h3 className={`line-clamp-1 text-zinc-900 hover:text-zinc-600 transition-colors ${isArabicName ? "text-base sm:text-lg font-semibold font-[family-name:var(--font-cairo)]" : "text-[15px] sm:text-[17px] font-medium tracking-tight"}`}>
              {product.name}
            </h3>
          </Link>
          {(product.category?.name || product.category_name) && (
            <span className="text-[13px] sm:text-sm text-zinc-400">
              {product.category?.name ?? product.category_name}
            </span>
          )}
          {shouldShowShortDescription && (
            <p className="line-clamp-1 text-xs text-zinc-500">
              {shortDescription}
            </p>
          )}
          <div className="mt-1 flex items-center justify-center gap-2" dir="ltr">
            {hasDiscount ? (
              <>
                <span className="text-sm text-zinc-400 line-through">{fmt(originalPrice)}</span>
                <span className="text-[15px] sm:text-base font-semibold text-[#c8a85a]">{fmt(effectivePrice)}</span>
              </>
            ) : (
              <span className="text-[15px] sm:text-base font-semibold text-zinc-900">{fmt(originalPrice)}</span>
            )}
          </div>
        </div>
      )}

      {isBoutique && (
        <div className={`flex ${shouldShowShortDescription ? 'h-[212px]' : 'h-[176px]'} flex-col overflow-hidden px-1 pt-4 pb-1 gap-1`}>
          {(product.category?.name || product.category_name) && (
            <span className="text-[13px] font-medium text-emerald-600">
              {product.category?.name ?? product.category_name}
            </span>
          )}
          {!(product.category?.name || product.category_name) && (
            <span className="h-[20px]" aria-hidden="true" />
          )}
          <Link href={`/${locale}/product/${product.id}`}>
            <h3 className={`line-clamp-2 min-h-[2.75em] text-zinc-900 leading-snug hover:text-zinc-600 transition-colors ${isArabicName ? "text-base sm:text-lg font-bold font-[family-name:var(--font-cairo)]" : "text-[15px] sm:text-[17px] font-bold tracking-tight"}`}>
              {product.name}
            </h3>
          </Link>
          {shouldShowShortDescription && (
            <p className="line-clamp-2 min-h-[2.5em] text-xs leading-snug text-zinc-500">
              {shortDescription}
            </p>
          )}
          <div className="flex min-h-6 items-center gap-2">
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
            data-no-global-progress="true"
            onClick={handleAdd}
            disabled={isOutOfStock}
            className={`mt-auto w-full rounded-[7px] py-3.5 text-sm font-medium transition-all duration-300 active:scale-[0.98] ${
              isOutOfStock
                ? 'cursor-not-allowed bg-zinc-100 text-zinc-400'
                : added
                ? 'bg-green-500 text-white'
                : 'bg-zinc-900 text-white hover:bg-zinc-800'
            }`}
          >
            {isOutOfStock ? outOfStockText : added ? <Check className="h-4 w-4 mx-auto" /> : (tHome.buy_now ?? 'Buy Now')}
          </button>
        </div>
      )}

      <VariantPickerModal
        open={variantOpen}
        onClose={() => setVariantOpen(false)}
        onConfirm={({ selectedColor, selectedSize }) => {
          setVariantOpen(false);
          commitAdd({ selectedColor, selectedSize });
        }}
        product={product}
        colors={colors}
        sizes={sizes}
      />
    </article>
  );
}

