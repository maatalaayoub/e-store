"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Share2, Heart } from "lucide-react";

export default function ProductGallery({ images = [], productName }) {
  const fallback = "/placeholder-view.svg";
  const list = images?.length > 0 ? images : [{ url: fallback, id: "fb" }];
  const [idx, setIdx] = useState(0);

  const prev = () => setIdx((i) => (i === 0 ? list.length - 1 : i - 1));
  const next = () => setIdx((i) => (i === list.length - 1 ? 0 : i + 1));

  const current = list[idx];

  return (
    <div className="flex gap-3">
      {/* LEFT: vertical thumbnail strip (desktop only) */}
      {list.length > 1 && (
        <div className="hidden lg:flex flex-col gap-2 w-[5.5rem] shrink-0">
          {list.map((img, i) => (
            <button
              key={img.id || i}
              onClick={() => setIdx(i)}
              className={`relative h-[5.5rem] w-full overflow-hidden rounded-xl bg-zinc-100 transition-all ${
                i === idx
                  ? "ring-2 ring-zinc-900"
                  : "ring-1 ring-zinc-200 hover:ring-zinc-400"
              }`}
            >
              <Image
                src={img.url}
                alt={`${productName} ${i + 1}`}
                fill
                className="object-cover object-center"
              />
            </button>
          ))}
        </div>
      )}

      {/* CENTER: main image */}
      <div className="relative flex-1 aspect-square overflow-hidden rounded-2xl bg-zinc-100">
        <Image
          src={current?.url || fallback}
          alt={productName}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover object-center"
        />

        {/* Prev/Next arrows on small screens */}
        {list.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-zinc-700 shadow hover:bg-white lg:hidden"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-zinc-700 shadow hover:bg-white lg:hidden"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* RIGHT: Share / Wishlist + prev-next arrows (desktop) */}
      <div className="hidden lg:flex flex-col gap-2 shrink-0">
        <button
          type="button"
          aria-label="Share"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
        >
          <Share2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Add to wishlist"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-red-500"
        >
          <Heart className="h-4 w-4" />
        </button>

        {list.length > 1 && (
          <div className="mt-auto flex flex-col gap-2">
            <button
              onClick={prev}
              aria-label="Previous"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={next}
              aria-label="Next"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Mobile thumbnail row */}
      {list.length > 1 && (
        <div className="absolute -bottom-16 left-0 right-0 flex gap-2 overflow-x-auto px-0.5 py-1 lg:hidden">
          {list.map((img, i) => (
            <button
              key={img.id || i}
              onClick={() => setIdx(i)}
              className={`relative flex-none h-16 w-16 overflow-hidden rounded-lg bg-zinc-100 transition-all ${
                i === idx
                  ? "ring-2 ring-zinc-900"
                  : "ring-1 ring-zinc-200"
              }`}
            >
              <Image
                src={img.url}
                alt={`${productName} ${i + 1}`}
                fill
                className="object-cover object-center"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
