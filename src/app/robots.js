import { getSeoSettings } from '@/lib/seo/settings';

// Private / non-indexable areas. Keeps admin, API and personal account pages
// out of search results. Paths are matched per-locale via the wildcard.
const DISALLOW = [
  '/*/admin',
  '/*/admin/*',
  '/api/',
  '/*/checkout',
  '/*/account',
  '/*/account/*',
  '/*/orders',
  '/*/order-confirmed',
  '/*/track-order',
  '/*/invoice',
  '/*/favorites',
  '/*/login',
  '/*/register',
];

export default async function robots() {
  const store = await getSeoSettings();
  const siteUrl = (store.siteUrl || '').replace(/\/+$/, '');

  // When the store defaults to noindex, keep crawlers out entirely.
  if (store.defaultIndex === false) {
    return {
      rules: { userAgent: '*', disallow: '/' },
      sitemap: siteUrl ? `${siteUrl}/sitemap.xml` : undefined,
    };
  }

  return {
    rules: { userAgent: '*', allow: '/', disallow: DISALLOW },
    sitemap: siteUrl ? `${siteUrl}/sitemap.xml` : undefined,
    host: siteUrl || undefined,
  };
}
