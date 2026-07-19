'use client';

import Link from 'next/link';

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
 * Mobile:  main hero image stacks full-width, followed by optional side cards.
 * Desktop: main hero takes ~2/3 width, side cards stack in the remaining ~1/3.
 *
 * The main hero height is driven entirely by the uploaded image's natural
 * aspect ratio (w-full h-auto) so nothing is cropped or distorted.
 */
export default function HeroIherb({ config = {}, locale = 'en' }) {
  const {
    main_image_url = '',
    main_cta_href = '/shop',
    text_align = 'left',
    overlay_opacity = 0,
    side_cards = [],
    translations = {},
  } = config;

  const t = translations[locale] || translations.en || {};
  const title = t.title ?? '';
  const description = t.description ?? '';
  const ctaText = t.cta_text ?? '';

  if (!main_image_url) return null;

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

  const mainHref = resolveHref(main_cta_href);

  return (
    <section className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* Main hero */}
        <HeroLink
          href={mainHref}
          className="group relative block overflow-hidden lg:rounded-xl bg-zinc-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={main_image_url}
            alt={title || 'Hero banner'}
            className="w-full h-auto block transition-transform duration-700 ease-out group-hover:scale-[1.02]"
            fetchpriority="high"
            loading="eager"
            decoding="async"
          />
          {hasOverlayText && (
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
          )}
        </HeroLink>

        {/* Side cards */}
        {side_cards.length > 0 && (
          <div className="flex flex-col gap-4">
            {side_cards.map((card, idx) => {
              if (!card?.image_url) return null;
              const ct = card.translations?.[locale] || card.translations?.en || {};
              const cardTitle = ct.title ?? '';
              const cardHref = resolveHref(card.href);
              return (
                <HeroLink
                  key={idx}
                  href={cardHref}
                  className="group relative flex-1 overflow-hidden lg:rounded-xl bg-zinc-100 min-h-[160px] lg:min-h-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.image_url}
                    alt={cardTitle || 'Promo card'}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                  {cardTitle && (
                    <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-4 md:p-5">
                      <span className="text-sm sm:text-base md:text-lg font-bold text-white drop-shadow-sm">
                        {cardTitle}
                      </span>
                    </div>
                  )}
                </HeroLink>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
