"use client";

import { useDictionary } from "@/components/providers/LocaleProvider";;
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { useCartStore } from "@/store/useCartStore";
import { resolveProductTranslation } from "@/lib/product-locale";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ProductCard({ product: rawProduct, onAdded }) {
  const dict = useDictionary();
  const { locale } = useParams();
  const tHome = dict?.home ?? {};
  const { addItem } = useCartStore();
  const { formatPrice } = useCurrency();

  const product = resolveProductTranslation(rawProduct, locale);

  const handleAdd = () => {
    addItem(product);
    onAdded?.();
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

  return (
    <article className="group flex flex-col h-full">
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

        <div className="mt-auto pt-4">
          <button
            onClick={handleAdd}
            className="w-full border border-zinc-900 rounded-[5px] py-3 sm:py-3.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.1em] text-zinc-900 transition-all duration-300 hover:bg-zinc-900 hover:text-white active:scale-[0.98]"
          >
            {tHome.buy_now}
          </button>
        </div>
      </div>
    </article>
  );
}

