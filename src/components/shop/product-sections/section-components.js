/**
 * Built-in storefront section components.
 *
 * Every component receives the same props:
 *   { section, product, locale, dict }
 *
 * Components return null when there's nothing meaningful to render so the
 * outer renderer doesn't draw an empty wrapper.
 */

import Link from 'next/link';
import {
  Truck, RotateCcw, Shield, ShieldCheck, Package, Clock, Check,
  Star, Megaphone, Sparkles, ChevronDown,
} from 'lucide-react';

const ICONS = {
  Truck, RotateCcw, Shield, ShieldCheck, Package, Clock, Check, Star, Megaphone, Sparkles,
};

function Icon({ name, className }) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return <Cmp className={className} />;
}

/** Common section title element (renders only when config.show_title). */
function SectionTitle({ section, fallback }) {
  if (section.config?.show_title === false) return null;
  const text = section.content?.title ?? fallback;
  if (!text) return null;
  return <h2 className="text-lg sm:text-xl font-semibold text-zinc-900 mb-4">{text}</h2>;
}

// ── DESCRIPTION ──────────────────────────────────────────────────────────────
export function DescriptionSection({ section, product }) {
  if (!product?.description) return null;
  const maxH = section.config?.max_height;
  return (
    <div>
      <SectionTitle section={section} fallback="Description" />
      <p
        className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line"
        style={maxH ? { maxHeight: `${maxH}px`, overflow: 'auto' } : undefined}
      >
        {product.description}
      </p>
    </div>
  );
}

// ── GALLERY ──────────────────────────────────────────────────────────────────
export function GallerySection({ section }) {
  const images = Array.isArray(section.content?.images) ? section.content.images : [];
  if (images.length === 0) return null;
  const cols = section.config?.columns ?? 3;
  const aspect = section.config?.aspect ?? 'square';
  const aspectClass =
    aspect === '4:3' ? 'aspect-[4/3]' : aspect === '16:9' ? 'aspect-video' : aspect === 'auto' ? '' : 'aspect-square';
  return (
    <div>
      <SectionTitle section={section} fallback="Gallery" />
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(cols, 1), 6)}, minmax(0, 1fr))` }}
      >
        {images.map((img, i) => (
          <div key={i} className={`relative overflow-hidden rounded-xl bg-zinc-100 ${aspectClass}`}>
            {/* Use plain <img> so we don't need to whitelist external hosts. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt ?? ''} loading="lazy" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SHIPPING ─────────────────────────────────────────────────────────────────
export function ShippingSection({ section }) {
  const items = Array.isArray(section.content?.items) ? section.content.items : [];
  if (items.length === 0) return null;
  return (
    <div>
      <SectionTitle section={section} fallback="Shipping & Returns" />
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border border-zinc-100 p-4">
            {it.icon ? <Icon name={it.icon} className="h-5 w-5 text-zinc-500 shrink-0 mt-0.5" /> : null}
            <div>
              {it.title && <h3 className="text-sm font-semibold text-zinc-900">{it.title}</h3>}
              {it.body && <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{it.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── REVIEWS  (placeholder until reviews API exists) ──────────────────────────
export function ReviewsSection({ section }) {
  const empty = section.content?.empty_text ?? 'No reviews yet.';
  return (
    <div>
      <SectionTitle section={section} fallback="Customer Reviews" />
      <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center">
        <Star className="mx-auto h-6 w-6 text-zinc-300" />
        <p className="mt-2 text-sm text-zinc-500">{empty}</p>
      </div>
    </div>
  );
}

// ── RATINGS  (placeholder distribution chart) ────────────────────────────────
export function RatingsSection({ section, product }) {
  const rating = product?.rating ?? 0;
  const total = product?.review_count ?? 0;
  return (
    <div>
      <SectionTitle section={section} fallback="Ratings" />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`h-5 w-5 ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-zinc-200'}`}
            />
          ))}
        </div>
        <span className="text-sm font-semibold text-zinc-900">{rating ? rating.toFixed(1) : '—'}</span>
        <span className="text-sm text-zinc-500">({total} reviews)</span>
      </div>
    </div>
  );
}

// ── SPECIFICATIONS ───────────────────────────────────────────────────────────
export function SpecificationsSection({ section }) {
  const items = Array.isArray(section.content?.items) ? section.content.items : [];
  if (items.length === 0) return null;
  return (
    <div>
      <SectionTitle section={section} fallback="Specifications" />
      <dl className="rounded-xl border border-zinc-100 divide-y divide-zinc-100 overflow-hidden">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 px-4 py-3">
            <dt className="text-sm font-medium text-zinc-700">{it.key}</dt>
            <dd className="sm:col-span-2 text-sm text-zinc-600">{it.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── FAQ  (accordion using <details> for zero-JS toggling) ────────────────────
export function FAQSection({ section }) {
  const items = Array.isArray(section.content?.items) ? section.content.items : [];
  if (items.length === 0) return null;
  return (
    <div>
      <SectionTitle section={section} fallback="FAQ" />
      <div className="space-y-2">
        {items.map((it, i) => (
          <details
            key={i}
            className="group rounded-xl border border-zinc-100 px-4 py-3 open:bg-zinc-50/60 transition-colors"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-zinc-900">
              <span>{it.question}</span>
              <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{it.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

// ── RICH TEXT ────────────────────────────────────────────────────────────────
export function RichTextSection({ section }) {
  const { title, body } = section.content ?? {};
  if (!title && !body) return null;
  const align = section.config?.align ?? 'start';
  const alignClass = align === 'center' ? 'text-center' : align === 'end' ? 'text-end' : 'text-start';
  return (
    <div className={alignClass}>
      <SectionTitle section={section} fallback="" />
      {body && <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{body}</p>}
    </div>
  );
}

// ── IMAGE + TEXT ─────────────────────────────────────────────────────────────
export function ImageTextSection({ section }) {
  const { title, body, image_url, cta_text, cta_href } = section.content ?? {};
  if (!title && !body && !image_url) return null;
  const imageRight = section.config?.image_position === 'right';
  return (
    <div className="grid items-center gap-6 md:grid-cols-2">
      {image_url && (
        <div className={`relative aspect-video overflow-hidden rounded-2xl bg-zinc-100 ${imageRight ? 'md:order-2' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image_url} alt={title ?? ''} loading="lazy" className="h-full w-full object-cover" />
        </div>
      )}
      <div>
        {title && <h2 className="text-xl font-semibold text-zinc-900">{title}</h2>}
        {body && <p className="mt-3 text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{body}</p>}
        {cta_text && cta_href && (
          <Link
            href={cta_href}
            className="mt-5 inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {cta_text}
          </Link>
        )}
      </div>
    </div>
  );
}

// ── VIDEO ────────────────────────────────────────────────────────────────────
function getEmbedUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // YouTube watch?v=…
    if (/youtube\.com$/.test(u.hostname) || /youtu\.be$/.test(u.hostname)) {
      const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (/vimeo\.com$/.test(u.hostname)) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

export function VideoSection({ section }) {
  const url = section.content?.video_url;
  if (!url) return null;
  const aspectMap = { '16:9': 'aspect-video', '4:3': 'aspect-[4/3]', '1:1': 'aspect-square', '9:16': 'aspect-[9/16]' };
  const aspectClass = aspectMap[section.config?.aspect] ?? 'aspect-video';
  const embed = getEmbedUrl(url);
  const isDirect = /\.(mp4|webm|ogg)(\?|$)/i.test(url);
  return (
    <div>
      <SectionTitle section={section} fallback="" />
      <div className={`relative w-full overflow-hidden rounded-2xl bg-black ${aspectClass}`}>
        {embed ? (
          <iframe
            src={embed}
            title={section.content?.title ?? 'Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : isDirect ? (
          <video
            src={url}
            controls
            playsInline
            autoPlay={!!section.config?.autoplay}
            muted={!!section.config?.autoplay}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
    </div>
  );
}

// ── BANNER ───────────────────────────────────────────────────────────────────
export function BannerSection({ section }) {
  const { title, subtitle, image_url, cta_text, cta_href } = section.content ?? {};
  if (!title && !subtitle && !image_url) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-zinc-900 text-white">
      {image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image_url} alt={title ?? ''} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      )}
      <div className="relative px-6 py-10 sm:px-12 sm:py-16 max-w-2xl">
        {title && <h2 className="text-2xl sm:text-3xl font-bold">{title}</h2>}
        {subtitle && <p className="mt-3 text-sm sm:text-base text-white/80">{subtitle}</p>}
        {cta_text && cta_href && (
          <Link
            href={cta_href}
            className="mt-5 inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
          >
            {cta_text}
          </Link>
        )}
      </div>
    </div>
  );
}

// ── RELATED PRODUCTS ─────────────────────────────────────────────────────────
export async function RelatedProductsSection({ section, product, locale }) {
  // Lazy-import to keep server-only deps out of the client bundle when this
  // component is tree-shaken away (e.g. in the admin preview).
  const { productService } = await import('@/modules/products/product.service');
  const { default: ProductCard } = await import('@/components/shop/ProductCard');

  const limit = section.content?.limit ?? 8;
  const cols = section.config?.columns ?? 4;
  const source = section.config?.source ?? 'category';

  // Read global button colours from store settings
  let filledBg = '#18181b';
  let filledText = '#ffffff';
  let outlineBorder = '#18181b';
  let outlineText = '#18181b';
  let outlineIcon = '#18181b';
  let outlineBg = 'transparent';
  let buttonFontSize = 10;
  let layout = 'overlay';
  try {
    const { createServiceClient } = await import('@/lib/supabase/service');
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', ['product_card_filled_bg', 'product_card_filled_text', 'product_card_outline_border', 'product_card_outline_text', 'product_card_outline_icon', 'product_card_outline_bg', 'product_card_button_font_size', 'product_card_layout']);
    for (const row of data ?? []) {
      if (row.key === 'product_card_filled_bg'      && row.value) filledBg     = row.value;
      if (row.key === 'product_card_filled_text'    && row.value) filledText   = row.value;
      if (row.key === 'product_card_outline_border' && row.value) outlineBorder = row.value;
      if (row.key === 'product_card_outline_text'   && row.value) outlineText   = row.value;
      if (row.key === 'product_card_outline_icon'   && row.value) outlineIcon   = row.value;
      if (row.key === 'product_card_outline_bg'     && row.value) outlineBg    = row.value;
      if (row.key === 'product_card_button_font_size' && row.value) buttonFontSize = parseInt(row.value) || 10;
      if (row.key === 'product_card_layout'         && row.value) layout       = row.value;
    }
  } catch { /* use defaults */ }

  let pool = [];
  try {
    if (source === 'featured') {
      pool = await productService.getProducts({ status: 'active', featured: true, limit: limit + 4, locale });
    } else if (source === 'latest') {
      pool = await productService.getProducts({ status: 'active', limit: limit + 4, locale });
    } else {
      pool = await productService.getProducts({ status: 'active', limit: limit + 4, locale });
      if (product?.category_id) pool = pool.filter((p) => p.category_id === product.category_id);
    }
  } catch {
    pool = [];
  }

  const items = pool.filter((p) => p.id !== product?.id).slice(0, limit);
  if (items.length === 0) return null;

  return (
    <div>
      <SectionTitle section={section} fallback="You may also like" />
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(cols, 2), 6)}, minmax(0, 1fr))` }}
      >
        {items.map((p) => (
          <ProductCard key={p.id} product={p} locale={locale} buttonStyle={section.config?.button_style} filledBg={filledBg} filledText={filledText} outlineBorder={outlineBorder} outlineText={outlineText} outlineIcon={outlineIcon} outlineBg={outlineBg} buttonFontSize={buttonFontSize} layout={layout} />
        ))}
      </div>
    </div>
  );
}

// ── CUSTOM ──────────────────────────────────────────────────────────────────
export function CustomSection({ section }) {
  const { title, subtitle, body, image_url, cta_text, cta_href, html } = section.content ?? {};
  const align = section.config?.align ?? 'start';
  const alignClass = align === 'center' ? 'text-center items-center' : align === 'end' ? 'text-end items-end' : 'text-start items-start';
  if (!title && !subtitle && !body && !image_url && !html) return null;
  return (
    <div className={`flex flex-col gap-3 ${alignClass}`}>
      {section.config?.icon && <Icon name={section.config.icon} className="h-6 w-6 text-zinc-500" />}
      {title && <h2 className="text-xl font-semibold text-zinc-900">{title}</h2>}
      {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
      {image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image_url} alt={title ?? ''} loading="lazy" className="rounded-xl max-w-full" />
      )}
      {body && <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{body}</p>}
      {html && (
        <div
          className="prose prose-sm max-w-none text-zinc-600"
          // Pre-sanitized server-side via sanitizeHtml() in sanitize.js
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
      {cta_text && cta_href && (
        <Link
          href={cta_href}
          className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          {cta_text}
        </Link>
      )}
    </div>
  );
}
