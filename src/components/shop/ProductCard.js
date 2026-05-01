"use client";

import { useDictionary } from "@/components/providers/LocaleProvider";
import { useCartStore } from "@/store/useCartStore";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ProductCard({ product, onAdded }) {
  const dict = useDictionary();
  const { locale } = useParams();
  const tHome = dict?.home ?? {};
  const { addItem } = useCartStore();

  const handleAdd = () => {
    addItem(product);
    onAdded?.();
  };

  // Resolve discount
  let effectivePrice = product.effective_price ?? product.price;
  const originalPrice = product.price;
  const hasDiscount =
    effectivePrice != null &&
    originalPrice != null &&
    Number(effectivePrice) < Number(originalPrice);

  const fmt = (n) => {
    if (n == null) return "";
    const num = Number(n);
    return `$${num.toFixed(2)}`;
  };

  // Image: prefer main_image, fallback to image, then null
  const imgSrc = product.main_image ?? product.image ?? null;

  // Badge: explicit badge > computed discount badge
  const badge = product.badge ?? null;

  return (
    <article className="group flex flex-col h-full">
      <Link href={`/${locale}/product/${product.id}`} className="relative aspect-square w-full overflow-hidden bg-[#ebebeb] block">
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

        <button
          aria-label={tHome.wishlist}
          onClick={(e) => {
            e.preventDefault();
            // TODO: Implement wishlist
          }}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center bg-white/80 backdrop-blur text-zinc-600 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:text-red-500"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
        </button>
      </Link>

      <div className="mt-4 sm:mt-5 flex flex-1 flex-col text-center">
        <Link href={`/${locale}/product/${product.id}`}>
          <h3 className="line-clamp-2 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-900 leading-snug sm:text-xs sm:tracking-[0.18em] hover:text-blue-600 transition-colors">
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
            className="w-full border border-zinc-900 py-3 sm:py-3.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.1em] text-zinc-900 transition-all duration-300 hover:bg-zinc-900 hover:text-white active:scale-[0.98]"
          >
            {tHome.buy_now}
          </button>
        </div>
      </div>
    </article>
  );
}

