"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

/**
 * HeroVideo
 * Full-viewport video-background hero. Video starts buffering immediately
 * and plays as soon as enough data is available.
 *
 * Props:
 *   config — { video_url, autoplay, loop, muted, poster_url,
 *              title, description, cta_text, cta_href, overlay_opacity (0-100) }
 */
export default function HeroVideo({ config = {}, locale = "en" }) {
  const tr = config.translations?.[locale] ?? config.translations?.en ?? {};
  const {
    video_url = "",
    autoplay = true,
    loop = true,
    muted = true,
    poster_url = "",
    overlay_opacity = 40,
    cta_href = "/shop",
  } = config;
  const title       = tr.title       || config.title       || "";
  const description = tr.description || config.description || "";
  const cta_text    = tr.cta_text    || config.cta_text    || "";

  const videoRef = useRef(null);

  // Intersection-observer based lazy load: only call load() when in view.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video_url) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.load();
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [video_url]);

  if (!video_url) return null;

  return (
    <section className="relative h-[100svh] w-full overflow-hidden -mt-[1px]">
      {/* Poster image shown while video is loading */}
      {poster_url && (
        <Image
          src={poster_url}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
      )}

      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        playsInline
        preload="auto"
        poster={poster_url || undefined}
      >
        <source src={video_url} />
      </video>

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
      </div>
    </section>
  );
}
