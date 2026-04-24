/**
 * Locale-aware Navigation Utilities
 *
 * Pure helper functions for constructing and parsing locale-prefixed URLs.
 * Import these wherever you need to build internal links or read the active
 * locale from a pathname — they have no side-effects and work in both server
 * and client contexts.
 */

import { locales, defaultLocale } from '@/i18n/config';

/**
 * Builds a locale-prefixed href.
 *
 * @example
 * localizedHref('fr', '/products') // → '/fr/products'
 * localizedHref('ar', '/')         // → '/ar/'
 *
 * @param {string} locale   - A supported locale identifier.
 * @param {string} pathname - Path to prefix (must begin with '/').
 * @returns {string}
 */
export function localizedHref(locale, pathname) {
  const safeLocale = locales.includes(locale) ? locale : defaultLocale;
  return `/${safeLocale}${pathname}`;
}

/**
 * Extracts the locale and the bare pathname from a locale-prefixed URL path.
 *
 * @example
 * parseLocalizedPathname('/fr/products') // → { locale: 'fr', pathname: '/products' }
 * parseLocalizedPathname('/en')          // → { locale: 'en', pathname: '/' }
 * parseLocalizedPathname('/unknown')     // → { locale: 'en', pathname: '/unknown' }
 *
 * @param {string} pathname - A full URL pathname, e.g. request.nextUrl.pathname.
 * @returns {{ locale: string, pathname: string }}
 */
export function parseLocalizedPathname(pathname) {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return { locale, pathname: '/' };
    if (pathname.startsWith(`/${locale}/`)) {
      return { locale, pathname: pathname.slice(locale.length + 1) };
    }
  }
  return { locale: defaultLocale, pathname };
}

/**
 * Switches the locale segment in an existing locale-prefixed pathname.
 *
 * @example
 * switchLocale('/fr/about', 'ar') // → '/ar/about'
 *
 * @param {string} pathname  - Current locale-prefixed pathname.
 * @param {string} newLocale - The target locale.
 * @returns {string}
 */
export function switchLocale(pathname, newLocale) {
  const { pathname: bare } = parseLocalizedPathname(pathname);
  return localizedHref(newLocale, bare);
}
