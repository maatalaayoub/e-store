"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useDictionary } from "@/components/providers/LocaleProvider";
import {
  HERO_SLIDE_DURATION_MS,
  HERO_TRANSITION_HALFWAY_MS,
  HERO_TRANSITION_END_MS,
} from "@/config/constants";

export default function HeroCarousel({ slides }) {
  const dict = useDictionary();
  const tHero = dict?.home ?? {};
  const [slideIndex, setSlideIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimers = useRef([]);
  const isFirstRender = useRef(true);

  // Auto-cycle slides
  useEffect(() => {
    const id = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, HERO_SLIDE_DURATION_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  // Cinematic transition: skip first render
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    transitionTimers.current.forEach(clearTimeout);
    transitionTimers.current = [];
    setIsTransitioning(true);
    const t1 = setTimeout(
      () => setDisplayIndex(slideIndex),
      HERO_TRANSITION_HALFWAY_MS
    );
    const t2 = setTimeout(
      () => setIsTransitioning(false),
      HERO_TRANSITION_END_MS
    );
    transitionTimers.current = [t1, t2];
  }, [slideIndex]);

  // Cleanup on unmount
  useEffect(() => () => transitionTimers.current.forEach(clearTimeout), []);

  if (!slides || slides.length === 0) return null;

  return (
    <section className="relative h-[100svh] w-full overflow-hidden -mt-[1px]">
      {slides.map((slide, i) => (
        <div
          key={slide.image}
          className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out ${
            i === slideIndex ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={i !== slideIndex}
        >
          <Image
            src={slide.image}
            alt={slide.title ? `${slide.title} promotional banner` : ""}
            fill
            // First slide is LCP \u2014 mark priority so it pre-loads on navigation.
            priority={i === 0}
            sizes="100vw"
            className={`object-cover will-change-transform transition-transform duration-[7000ms] ease-out ${
              i === slideIndex ? "scale-105" : "scale-100"
            }`}
          />
        </div>
      ))}

      {/* next/image handles preloading via priority for slide 0; subsequent
          slides are preloaded by the browser as soon as they enter the DOM. */}

      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-[800ms] ease-in-out ${
          isTransitioning ? "opacity-50" : "opacity-20"
        }`}
      />

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center text-white">
        <div
          key={displayIndex}
          className={`flex flex-col items-center transition-all duration-[800ms] ease-in-out ${
            isTransitioning
              ? "opacity-0 translate-y-6"
              : "opacity-100 translate-y-0"
          }`}
        >
          <h1
            className="font-light uppercase tracking-[0.25em] text-3xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.15] max-w-5xl drop-shadow-lg"
            style={{ letterSpacing: "0.2em" }}
          >
            {slides[displayIndex].title}
          </h1>
          <Link
            href={slides[displayIndex].href}
            className="mt-10 inline-flex items-center justify-center border border-white/80 px-10 py-3.5 text-xs sm:text-sm font-light uppercase tracking-[0.4em] text-white transition-all duration-300 hover:bg-white hover:text-zinc-900 hover:tracking-[0.5em]"
          >
            {slides[displayIndex].cta}
          </Link>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3">
          {slides.map((_, i) => {
            const isActive = i === slideIndex;
            return (
              <button
                key={i}
                onClick={() => setSlideIndex(i)}
                aria-label={(tHero.go_to_slide ?? "Go to slide {n}").replace("{n}", String(i + 1))}
                className={`relative h-[2px] overflow-hidden transition-all duration-500 ${
                  isActive ? "w-12 bg-white/30" : "w-6 bg-white/40 hover:bg-white/70"
                }`}
              >
                {isActive && (
                  <span
                    key={slideIndex}
                    className="absolute inset-0 bg-white animate-hero-progress"
                    style={{ animationDuration: `${HERO_SLIDE_DURATION_MS}ms` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
