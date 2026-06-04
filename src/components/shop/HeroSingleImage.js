"use client";

import Image from "next/image";
import Link from "next/link";

/**
 * HeroSingleImage
 * Full-viewport static hero with a single background image, overlay,
 * optional title/description and a CTA button.
 *
 * Props:
 *   config — { image_url, title, description, cta_text, cta_href,
 *              overlay_opacity (0-100), text_align ('left'|'center'|'right') }
 */
export default function HeroSingleImage({ config = {}, locale = "en" }) {
  const tr = config.translations?.[locale] ?? config.translations?.en ?? {};
  const {
    image_url = "",
    overlay_opacity = 40,
    text_align = "center",
    cta_href = "/shop",
  } = config;
  const title       = tr.title       || config.title       || "";
  const description = tr.description || config.description || "";
  const cta_text    = tr.cta_text    || config.cta_text    || "";

  if (!image_url) return null;

  const alignClass =
    text_align === "left"
      ? "items-start text-left px-6 sm:px-12 lg:px-20"
      : text_align === "right"
      ? "items-end text-right px-6 sm:px-12 lg:px-20"
      : "items-center text-center px-6";

  return (
    <section className="relative h-[100svh] w-full overflow-hidden -mt-[1px]">
      <Image
        src={image_url}
        alt={title ? `${title} hero image` : "Hero image"}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      {/* Configurable overlay */}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: Math.min(100, Math.max(0, overlay_opacity)) / 100 }}
      />

      <div
        className={`relative z-10 flex h-full w-full flex-col justify-center text-white ${alignClass}`}
      >
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
      </div>
    </section>
  );
}
