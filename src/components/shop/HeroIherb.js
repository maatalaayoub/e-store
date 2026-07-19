'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

function HeroLink({ href, className, children }) {
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return <Link href={href} className={className}>{children}</Link>;
}

/**
 * iHerb-style responsive hero.
 *
 * Mobile:  a full-width, swipeable banner carousel (main banner + promo cards)
 *          with pagination dots — just like the iHerb mobile homepage.
 * Desktop: main hero takes ~2/3 width, promo cards stack in the remaining ~1/3.
 */
export default function HeroIherb({ config = {}, locale = 'en' }) {
  const {
    main_image_url = '',
    main_cta_href = '/shop',
    text_align = 'left',
    overlay_opacity = 0,
    side_cards = [],
    mobile_position = 'behind',
    autoplay = false,
    autoplay_interval = 5,
    translations = {},
  } = config;

  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  const t = translations[locale] || translations.en || {};
  const title = t.title ?? '';
  const description = t.description ?? '';
  const ctaText = t.cta_text ?? '';

  const alignClasses = {
    left: 'items-start text-start',
    center: 'items-center text-center',
    right: 'items-end text-end',
  };
  const contentAlign = alignClasses[text_align] ?? alignClasses.left;

  const hasOverlayText = Boolean(title || description || ctaText);
  const overlayStyle = {
    backgroundColor: `rgba(0,0,0,${Math.max(0, Math.min(overlay_opacity, 100)) / 100})`,
  };

  const resolveHref = (path) => {
    if (!path) return `/${locale}`;
    if (/^https?:\/\//i.test(path)) return path;
    return `/${locale}${path.startsWith('/') ? path : `/${path}`}`;
  };

  if (!main_image_url) return null;

  const mainHref = resolveHref(main_cta_href);
  const isMobileBelow = mobile_position === 'below';

  // Offset that clears the fixed header (+ optional announcement bar).
  const headerOffset = 'calc(var(--bar-height, 0px) + var(--header-height, 3.5rem))';

  // Combined list used by the mobile carousel: main banner first, then cards.
  const validCards = (side_cards ?? []).filter((c) => c?.image_url);
  const slides = [
    { key: 'main', href: mainHref, image: main_image_url, isMain: true },
    ...validCards.map((card, i) => {
      const ct = card.translations?.[locale] || card.translations?.en || {};
      return { key: `card-${i}`, href: resolveHref(card.href), image: card.image_url, title: ct.title ?? '', isMain: false };
    }),
  ];

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    setActive(Math.max(0, Math.min(i, slides.length - 1)));
  };

  const goTo = (i) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  // ── Desktop slider state ──
  const total = slides.length;
  const visibleCount = Math.min(3, total);           // 1 big banner + up to 2 preview tiles
  const canPage = total > visibleCount;              // only page when slides are hidden
  const activeSlide = slides[Math.min(active, total - 1)] ?? slides[0];
  const previews = [];
  for (let k = 1; k <= 2 && k < total; k++) {
    previews.push({ ...slides[(active + k) % total], index: (active + k) % total });
  }
  // Advance/rewind by a whole visible set so hidden slides are revealed and the
  // images inside the current set are fully replaced.
  const goNext = () => setActive((a) => (a + visibleCount) % total);
  const goPrev = () => setActive((a) => (a - visibleCount + total) % total);

  // Auto-advance the hero at the admin-configured interval.
  // Desktop pages through whole sets; mobile scrolls to the next slide.
  useEffect(() => {
    if (!autoplay || total <= 1 || typeof window === 'undefined') return undefined;
    const ms = Math.max(1000, (Number(autoplay_interval) || 5) * 1000);
    const mq = window.matchMedia('(min-width: 1024px)');
    let id = null;
    const stop = () => { if (id) { clearInterval(id); id = null; } };
    const start = () => {
      stop();
      id = setInterval(() => {
        if (mq.matches) {
          if (canPage) setActive((a) => (a + visibleCount) % total);
        } else {
          setActive((a) => {
            const nextI = (a + 1) % total;
            const el = trackRef.current;
            if (el) el.scrollTo({ left: nextI * el.clientWidth, behavior: 'smooth' });
            return nextI;
          });
        }
      }, ms);
    };
    start();
    mq.addEventListener?.('change', start);
    return () => { stop(); mq.removeEventListener?.('change', start); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, autoplay_interval, total, canPage, visibleCount]);

  // ── Overlay renderers (shared between mobile carousel & desktop grid) ──
  const MainOverlay = () =>
    hasOverlayText ? (
      <div
        className={`absolute inset-0 flex flex-col justify-center px-6 py-8 md:px-10 md:py-12 ${contentAlign}`}
        style={overlayStyle}
      >
        <div className="max-w-md">
          {title && (
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight drop-shadow-sm">
              {title}
            </h2>
          )}
          {description && (
            <p className="mt-3 text-sm sm:text-base md:text-lg text-white/90 drop-shadow-sm">
              {description}
            </p>
          )}
          {ctaText && (
            <span className="mt-5 inline-flex items-center rounded-full bg-white px-5 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-900 transition-transform group-hover:scale-105">
              {ctaText}
            </span>
          )}
        </div>
      </div>
    ) : null;

  const CardOverlay = ({ cardTitle }) =>
    cardTitle ? (
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-4 md:p-5">
        <span className="text-sm sm:text-base md:text-lg font-bold text-white drop-shadow-sm">
          {cardTitle}
        </span>
      </div>
    ) : null;

  return (
    <section
      className={`w-full lg:px-8 xl:px-12 ${
        isMobileBelow ? 'pt-[var(--iherb-offset)]' : ''
      } lg:pt-[calc(var(--iherb-offset)+1rem)]`}
      style={{ '--iherb-offset': headerOffset }}
    >
      {/* ───────── Mobile: swipeable full-width banner carousel ───────── */}
      <div className="lg:hidden">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((s, i) => (
            <HeroLink
              key={s.key}
              href={s.href}
              className="group relative block aspect-[16/9] w-full shrink-0 basis-full snap-center overflow-hidden bg-zinc-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.image}
                alt={s.isMain ? (title || 'Hero banner') : (s.title || 'Promo card')}
                className="absolute inset-0 h-full w-full object-cover"
                fetchPriority={i === 0 ? 'high' : undefined}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
              {s.isMain ? <MainOverlay /> : <CardOverlay cardTitle={s.title} />}
            </HeroLink>
          ))}
        </div>

        {/* Pagination dots */}
        {slides.length > 1 && (
          <div className="flex items-center justify-center gap-2 py-3">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === active ? 'w-5 bg-zinc-800' : 'w-2 bg-zinc-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ───────── Desktop: big banner slider + upcoming preview tiles ───────── */}
      <div className="relative hidden lg:block">
        {/* Large navigation arrows fixed to the left/right edges of the screen */}
        {canPage && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous slides"
              className="absolute left-0 top-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-lg ring-1 ring-black/5 transition hover:bg-white hover:scale-105"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 rtl:rotate-180">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next slides"
              className="absolute right-0 top-1/2 z-20 flex h-14 w-14 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-lg ring-1 ring-black/5 transition hover:bg-white hover:scale-105"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 rtl:rotate-180">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </>
        )}

        <div className={`grid gap-4 ${previews.length > 0 ? 'grid-cols-[2fr_1fr]' : 'grid-cols-1'}`}>
          {/* Left: sliding main banner */}
          <div className="relative overflow-hidden rounded-xl bg-zinc-100">
            <HeroLink href={activeSlide.href} className="group relative block aspect-[16/9] w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={activeSlide.key}
                src={activeSlide.image}
                alt={activeSlide.isMain ? (title || 'Hero banner') : (activeSlide.title || 'Promo banner')}
                className="absolute inset-0 h-full w-full object-cover gallery-fade-in transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                fetchPriority="high"
                loading="eager"
                decoding="async"
              />
              {activeSlide.isMain ? <MainOverlay /> : <CardOverlay cardTitle={activeSlide.title} />}
            </HeroLink>
          </div>

          {/* Right: upcoming slides as preview tiles */}
          {previews.length > 0 && (
            <div className="flex flex-col gap-4">
              {previews.map((p) => (
                <HeroLink
                  key={p.key}
                  href={p.href}
                  className="group relative flex-1 overflow-hidden rounded-xl bg-zinc-100 min-h-[160px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt={p.isMain ? (title || 'Hero banner') : (p.title || 'Promo card')}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    loading="lazy"
                    decoding="async"
                  />
                  {p.isMain ? <MainOverlay /> : <CardOverlay cardTitle={p.title} />}
                </HeroLink>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
