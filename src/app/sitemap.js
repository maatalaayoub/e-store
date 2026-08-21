import { locales } from '@/i18n/config';
import { getSeoSettings } from '@/lib/seo/settings';
import { productRepository } from '@/modules/products/product.repository';
import { firstNonEmpty } from '@/lib/seo/resolve';

// Public, indexable static routes (relative to a locale segment).
const STATIC_PATHS = ['', '/contact'];

/** Build a { locale: url } alternates map for a locale-agnostic path. */
function languageAlternates(siteUrl, pathWithoutLocale) {
  const languages = {};
  for (const loc of locales) {
    languages[loc] = `${siteUrl}/${loc}${pathWithoutLocale}`;
  }
  return languages;
}

export default async function sitemap() {
  const store = await getSeoSettings();
  const siteUrl = (store.siteUrl || '').replace(/\/+$/, '');
  const now = new Date();
  const entries = [];

  // Static pages, one canonical entry per locale with hreflang alternates.
  for (const path of STATIC_PATHS) {
    for (const locale of locales) {
      entries.push({
        url: `${siteUrl}/${locale}${path}`,
        lastModified: now,
        changeFrequency: path === '' ? 'daily' : 'monthly',
        priority: path === '' ? 1 : 0.5,
        alternates: { languages: languageAlternates(siteUrl, path) },
      });
    }
  }

  // Products.
  let products = [];
  try {
    products = await productRepository.findAllForSitemap();
  } catch {
    products = [];
  }

  for (const product of products) {
    const idOrSlug = firstNonEmpty(product.slug, product.id);
    if (!idOrSlug) continue;
    const path = `/product/${idOrSlug}`;
    const lastModified = product.updated_at ? new Date(product.updated_at) : now;
    for (const locale of locales) {
      entries.push({
        url: `${siteUrl}/${locale}${path}`,
        lastModified,
        changeFrequency: 'weekly',
        priority: 0.8,
        alternates: { languages: languageAlternates(siteUrl, path) },
      });
    }
  }

  return entries;
}
