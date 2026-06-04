"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * HeroMultiImage
 * Full-viewport hero that cycles through multiple images.
 * Images come from the same hero_slides DB table (same source as slider hero).
 *
 * Props:
 *   config — { auto_rotate, rotation_interval, title, description,
 *              cta_text, cta_href, overlay_opacity (0-100) }
 *   images — array of { image, title, cta, href } (mapped from hero_slides)
 */
export default function HeroMultiImage({ config = {}, images = [], locale = "en" }) {
  const tr = config.translations?.[locale] ?? config.translations?.en ?? {};
  const {
    auto_rotate = true,
    rotation_interval = 4000,
    overlay_opacity = 40,
    cta_href = "/shop",
  } = config;
  const title       = tr.title       || config.title       || "";
  const description = tr.description || config.description || "";
  const cta_text    = tr.cta_text    || config.cta_text    || "";

  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!auto_rotate || images.length < 2) return;
    timerRef.current = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % images.length);
    }, Math.max(1000, rotation_interval));
    return () => clearInterval(timerRef.current);
  }, [auto_rotate, rotation_interval, images.length]);

  if (!images?.length) return null;

  return (
    <section className="relative h-[100svh] w-full overflow-hidden -mt-[1px]">
      {images.map((img, i) => (
        <div
          key={img.image ?? i}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            i === activeIdx ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={i !== activeIdx}
        >
          <Image
            src={img.image}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority={i === 0}
          />
        </div>
      ))}

      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: Math.min(100, Math.max(0, overlay_opacity)) / 100 }}
      />

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center text-white">
        {title && (
          <h1
            className="font-light uppercase tracking-[0.25em] text-3xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.15] max-w-5xl drop-shadow-lg"
            style={{ letterSpacing: "0.2em" }}
          >
            {title}
          </h1>
        )}
        {description && (
          <p className="mt-5 text-base sm:text-lg font-light max-w-2xl leading-relaxed text-white/90">
            {description}
          </p>
        )}
        {cta_text && cta_href && (
          <Link
            href={cta_href}
            className="mt-10 inline-flex items-center justify-center border border-white/80 px-10 py-3.5 text-xs sm:text-sm font-light uppercase tracking-[0.4em] text-white transition-all duration-300 hover:bg-white hover:text-zinc-900 hover:tracking-[0.5em]"
          >
            {cta_text}
          </Link>
        )}

        {/* Navigation dots */}
        {images.length > 1 && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  clearInterval(timerRef.current);
                  setActiveIdx(i);
                }}
                aria-label={`Go to image ${i + 1}`}
                className={`h-[2px] rounded-full transition-all duration-500 ${
                  i === activeIdx ? "w-10 bg-white" : "w-5 bg-white/50 hover:bg-white/75"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
