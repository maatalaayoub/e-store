"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

function pad(n) {
  return String(Math.max(0, n)).padStart(2, "0");
}

function useCountdown(endDateStr) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!endDateStr) return;
    const end = new Date(endDateStr).getTime();
    if (isNaN(end)) return;

    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0) {
        setExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor((diff % 86_400_000) / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
        seconds: Math.floor((diff % 60_000) / 1_000),
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDateStr]);

  return { timeLeft, expired };
}

/**
 * HeroCountdown
 * Full-viewport hero with a live countdown timer.
 *
 * Props:
 *   config — { background_type ('image'|'video'), background_url,
 *              title, description, countdown_end (ISO string),
 *              cta_text, cta_href,
 *              expired_behavior ('hide'|'show_hero'|'show_message'),
 *              expired_message, overlay_opacity (0-100) }
 */
export default function HeroCountdown({ config = {}, locale = "en" }) {
  const tr = config.translations?.[locale] ?? config.translations?.en ?? {};
  const {
    background_type = "image",
    background_url = "",
    countdown_end = "",
    expired_behavior = "hide",
    overlay_opacity = 40,
    cta_href = "/shop",
  } = config;
  const title           = tr.title           || config.title           || "";
  const description     = tr.description     || config.description     || "";
  const cta_text        = tr.cta_text        || config.cta_text        || "";
  const expired_message = tr.expired_message || config.expired_message || "";

  const { timeLeft, expired } = useCountdown(countdown_end);
  const videoRef = useRef(null);

  // Lazy-load background video via IntersectionObserver.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { el.load(); obs.disconnect(); }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [background_url]);

  // Hide entirely once expired if configured.
  if (expired && expired_behavior === "hide") return null;

  const opacity = Math.min(100, Math.max(0, overlay_opacity)) / 100;

  return (
    <section className="relative h-[100svh] w-full overflow-hidden -mt-[1px]">
      {/* Background */}
      {background_url && background_type === "image" && (
        <Image
          src={background_url}
          alt={title || "Countdown hero"}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      )}
      {background_url && background_type === "video" && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          preload="none"
        >
          <source src={background_url} />
        </video>
      )}

      <div className="absolute inset-0 bg-black" style={{ opacity }} />

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center text-white">
        {/* Expired message state */}
        {expired && expired_behavior === "show_message" ? (
          <p className="text-xl font-light text-white/90 max-w-xl">
            {expired_message || "This event has ended."}
          </p>
        ) : (
          <>
            {title && (
              <h1
                className="font-light uppercase tracking-[0.25em] text-3xl sm:text-5xl md:text-6xl leading-[1.15] max-w-5xl drop-shadow-lg mb-6"
                style={{ letterSpacing: "0.2em" }}
              >
                {title}
              </h1>
            )}
            {description && (
              <p className="mb-8 text-base sm:text-lg font-light max-w-2xl leading-relaxed text-white/90">
                {description}
              </p>
            )}

            {/* Countdown digits */}
            {timeLeft && (
              <div className="flex items-center gap-4 sm:gap-10 mb-10">
                {[
                  { value: timeLeft.days,    label: "Days" },
                  { value: timeLeft.hours,   label: "Hours" },
                  { value: timeLeft.minutes, label: "Min" },
                  { value: timeLeft.seconds, label: "Sec" },
                ].map(({ value, label }) => (
                  <div key={label} className="flex flex-col items-center min-w-[3rem]">
                    <span className="text-4xl sm:text-6xl font-light tabular-nums drop-shadow-lg">
                      {pad(value)}
                    </span>
                    <span className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/60">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {cta_text && cta_href && (
              <Link
                href={cta_href}
                className="inline-flex items-center justify-center border border-white/80 px-10 py-3.5 text-xs sm:text-sm font-light uppercase tracking-[0.4em] text-white transition-all duration-300 hover:bg-white hover:text-zinc-900 hover:tracking-[0.5em]"
              >
                {cta_text}
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}
