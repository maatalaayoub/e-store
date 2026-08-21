/**
 * Build Next.js `Metadata` objects from resolved SEO data.
 *
 * Pure functions (no server-only imports) so they can be unit tested and used
 * from any server component's `generateMetadata`.
 */

import { locales, localeMetadata } from '@/i18n/config';
import { SEO_LIMITS } from './constants';
import {
  absoluteUrl,
  firstNonEmpty,
  resolveProductSeo,
  truncate,
} from './resolve';

/** Map an app locale (en/ar/fr/dr) to an Open Graph locale string. */
function ogLocale(locale) {
  switch (locale) {
    case 'ar':
      return 'ar_AR';
    case 'dr':
      return 'ar_MA';
    case 'fr':
      return 'fr_FR';
    default:
      return 'en_US';
  }
}

/**
 * Build `alternates.languages` for hreflang, mapping every supported locale to
 * the same path with its locale segment swapped in.
 */
export function buildLanguageAlternates(pathWithoutLocale) {
  const languages = {};
  for (const loc of locales) {
    const dir = localeMetadata[loc]?.dir;
    void dir;
    languages[loc] = `/${loc}${pathWithoutLocale}`;
  }
  return languages;
}

/** Common robots block. */
function robotsFor(index, follow) {
  return {
    index,
    follow,
    googleBot: {
      index,
      follow,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  };
}

/**
 * Product page metadata.
 * @param {object} args
 * @param {object} args.product  locale-normalized product (name/desc resolved)
 * @param {string} args.locale
 * @param {object} args.store    resolved store SEO (see settings.js)
 * @param {string} args.siteUrl  absolute site origin
 */
export function buildProductMetadata({ product, locale, store, siteUrl }) {
  const r = resolveProductSeo({ product, locale, store, siteUrl });
  const pathNoLocale = `/product/${firstNonEmpty(product?.slug, product?.id)}`;

  const images = r.ogImage
    ? [{ url: r.ogImage, alt: r.title }]
    : undefined;

  return {
    title: { absolute: r.title },
    description: truncate(r.description, SEO_LIMITS.description.hardMax),
    keywords: r.keywords || undefined,
    alternates: {
      canonical: r.canonical,
      languages: buildLanguageAlternates(pathNoLocale),
    },
    robots: robotsFor(r.index, r.follow),
    openGraph: {
      type: 'website',
      title: r.ogTitle,
      description: truncate(r.ogDescription, SEO_LIMITS.ogDescription.max),
      url: r.canonical,
      siteName: firstNonEmpty(store?.siteName) || undefined,
      locale: ogLocale(locale),
      images,
    },
    twitter: {
      card: firstNonEmpty(store?.twitterCard) || 'summary_large_image',
      site: firstNonEmpty(store?.twitterSite) || undefined,
      title: r.ogTitle,
      description: truncate(r.ogDescription, SEO_LIMITS.ogDescription.max),
      images: r.ogImage ? [r.ogImage] : undefined,
    },
  };
}

/**
 * Homepage / store-level metadata.
 */
export function buildStoreMetadata({ locale, store, siteUrl }) {
  const siteName = firstNonEmpty(store?.siteName);
  const title = firstNonEmpty(store?.defaultTitle, siteName);
  const description = firstNonEmpty(store?.defaultDescription);
  const canonical = absoluteUrl(siteUrl, `/${locale}`);
  const ogImage = firstNonEmpty(store?.defaultOgImage) || null;

  return {
    title: title ? { absolute: title } : undefined,
    description: description || undefined,
    keywords: firstNonEmpty(store?.defaultKeywords) || undefined,
    alternates: {
      canonical,
      languages: buildLanguageAlternates(''),
    },
    robots: robotsFor(store?.defaultIndex !== false, store?.defaultFollow !== false),
    openGraph: {
      type: 'website',
      title: firstNonEmpty(store?.ogTitle, title) || undefined,
      description: firstNonEmpty(store?.ogDescription, description) || undefined,
      url: canonical,
      siteName: siteName || undefined,
      locale: ogLocale(locale),
      images: ogImage ? [{ url: ogImage, alt: title || siteName }] : undefined,
    },
    twitter: {
      card: firstNonEmpty(store?.twitterCard) || 'summary_large_image',
      site: firstNonEmpty(store?.twitterSite) || undefined,
      title: firstNonEmpty(store?.ogTitle, title) || undefined,
      description: firstNonEmpty(store?.ogDescription, description) || undefined,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

/**
 * Root/base metadata shared by every locale route. Sets `metadataBase`, the
 * title template, and store-wide defaults so any page that does not override a
 * field still emits valid metadata.
 */
export function buildBaseMetadata({ store, siteUrl }) {
  const siteName = firstNonEmpty(store?.siteName) || 'Store';
  const template = firstNonEmpty(store?.titleTemplate, '%s | %site%').replace(
    '%site%',
    siteName,
  );
  const defaultTitle = firstNonEmpty(store?.defaultTitle, siteName);

  let metadataBase;
  try {
    metadataBase = siteUrl ? new URL(siteUrl) : undefined;
  } catch {
    metadataBase = undefined;
  }

  const meta = {
    metadataBase,
    title: {
      default: defaultTitle,
      template,
    },
    description: firstNonEmpty(store?.defaultDescription) || undefined,
    applicationName: siteName,
    robots: robotsFor(store?.defaultIndex !== false, store?.defaultFollow !== false),
    openGraph: {
      type: 'website',
      siteName,
      title: defaultTitle,
      description: firstNonEmpty(store?.defaultDescription) || undefined,
    },
    twitter: {
      card: firstNonEmpty(store?.twitterCard) || 'summary_large_image',
      site: firstNonEmpty(store?.twitterSite) || undefined,
    },
  };

  const favicon = firstNonEmpty(store?.favicon);
  if (favicon) meta.icons = { icon: favicon, shortcut: favicon, apple: favicon };

  return meta;
}
