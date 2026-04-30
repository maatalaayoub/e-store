"use client";

import { useDictionary } from "@/components/providers/LocaleProvider";
import { useCartStore } from "@/store/useCartStore";

export default function ProductCard({ product, onAdded }) {
  const dict = useDictionary();
  const tHome = dict?.home ?? {};
  const { addItem } = useCartStore();

  const handleAdd = () => {
    addItem(product);
    onAdded?.();
  };

  return (
    <article className="group flex flex-col h-full">
      <div className="relative aspect-square w-full overflow-hidden bg-[#ebebeb]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        {product.badge && (
          <span
            dir="ltr"
            className="absolute left-3 top-3 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-900 shadow-sm"
          >
            {product.badge}
          </span>
        )}
        <button
          aria-label={tHome.wishlist}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center bg-white/80 backdrop-blur text-zinc-600 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:text-red-500"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>
      </div>

      <div className="mt-4 sm:mt-5 flex flex-1 flex-col text-center">
        <h3 className="line-clamp-2 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-900 leading-snug sm:text-xs sm:tracking-[0.18em]">
          {product.name}
        </h3>
        <p className="mt-2 text-sm sm:text-base tracking-widest text-zinc-500 uppercase">
          {product.price}
        </p>
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
