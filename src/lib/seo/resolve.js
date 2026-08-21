/**
 * Pure SEO resolution helpers.
 *
 * These functions turn raw product/store data + manually entered SEO overrides
 * into the final, concrete values used both by the public metadata generation
 * (server) and the admin preview/validation (client). No server-only imports.
 *
 * Golden rule: a manually entered value always wins; when it is blank we fall
 * back to a sensible value derived from existing product/store data.
 */

/** Collapse whitespace and strip HTML tags/entities to plain text. */
export function stripHtml(input) {
  if (!input) return '';
  return String(input)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Truncate to `max` chars on a word boundary, appending an ellipsis. */
export function truncate(input, max) {
  const text = stripHtml(input);
  if (!text || text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${base.trim()}…`;
}

/** First non-empty string from the arguments (after trimming). */
export function firstNonEmpty(...values) {
  for (const value of values) {
    if (value == null) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return '';
}

/**
 * Build a URL-safe slug from arbitrary text. Handles Latin and keeps Arabic
 * letters (the store supports ar/dr) while dropping punctuation.
 */
export function slugify(input) {
  if (!input) return '';
  return String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip Latin diacritics
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '-') // keep Arabic block
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 96);
}

/** True when the value looks like a well-formed http(s) absolute URL. */
export function isValidHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Join a base site URL and a path into a single absolute URL. */
export function absoluteUrl(siteUrl, path) {
  const base = String(siteUrl || '').replace(/\/+$/, '');
  const rel = String(path || '');
  if (isValidHttpUrl(rel)) return rel;
  if (!base) return rel;
  return `${base}${rel.startsWith('/') ? '' : '/'}${rel}`;
}

/** Read the SEO override object for a locale, merged over the base overrides. */
export function seoForLocale(seo, locale) {
  const base = seo && typeof seo === 'object' ? seo : {};
  const perLocale = base.translations && typeof base.translations === 'object'
    ? base.translations[locale] ?? {}
    : {};
  return {
    title: firstNonEmpty(perLocale.title, base.title),
    description: firstNonEmpty(perLocale.description, base.description),
    keywords: firstNonEmpty(perLocale.keywords, base.keywords),
    og_title: firstNonEmpty(perLocale.og_title, base.og_title),
    og_description: firstNonEmpty(perLocale.og_description, base.og_description),
    canonical_url: firstNonEmpty(base.canonical_url),
    og_image: firstNonEmpty(base.og_image),
    no_index: base.no_index === true,
    no_follow: base.no_follow === true,
  };
}

/**
 * Resolve the effective SEO for a product in a given locale.
 * `product` is expected to already be locale-normalized (name/description in
 * the target locale), which is how productService returns it.
 *
 * @returns {{
 *   title:string, rawTitle:string, description:string, keywords:string,
 *   slug:string, path:string, canonical:string, image:string|null,
 *   ogTitle:string, ogDescription:string, ogImage:string|null,
 *   index:boolean, follow:boolean,
 * }}
 */
export function resolveProductSeo({ product, locale, store, siteUrl }) {
  const seo = seoForLocale(product?.seo, locale);
  const siteName = firstNonEmpty(store?.siteName);

  const productName = firstNonEmpty(product?.name);
  const autoTitle = siteName ? `${productName} | ${siteName}` : productName;
  const rawTitle = firstNonEmpty(seo.title, productName);
  const title = firstNonEmpty(seo.title, autoTitle);

  const autoDescription = truncate(
    firstNonEmpty(product?.short_description, product?.description),
    160,
  );
  const description = firstNonEmpty(seo.description, autoDescription);

  const keywords = firstNonEmpty(
    seo.keywords,
    store?.defaultKeywords,
  );

  const slug = firstNonEmpty(product?.slug, slugify(productName));
  const idOrSlug = firstNonEmpty(product?.slug, product?.id);
  const path = `/${locale}/product/${idOrSlug}`;
  const canonical = firstNonEmpty(
    seo.canonical_url,
    absoluteUrl(siteUrl, path),
  );

  const image = product?.main_image || product?.image || null;
  const ogImage = firstNonEmpty(seo.og_image, image, store?.defaultOgImage) || null;

  const ogTitle = firstNonEmpty(seo.og_title, title);
  const ogDescription = firstNonEmpty(seo.og_description, description);

  const index = store ? (seo.no_index ? false : store.defaultIndex !== false) : !seo.no_index;
  const follow = store ? (seo.no_follow ? false : store.defaultFollow !== false) : !seo.no_follow;

  return {
    title,
    rawTitle,
    description,
    keywords,
    slug,
    path,
    canonical,
    image,
    ogTitle,
    ogDescription,
    ogImage,
    index,
    follow,
  };
}
