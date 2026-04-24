/**
 * proxy.js — Language Detection & Locale Routing
 *
 * This file replaces the deprecated middleware.js convention (Next.js 16+).
 * It runs on the Edge before every non-static request and ensures every URL
 * is prefixed with a supported locale.
 *
 * Detection order:
 *   1. If the URL already contains a supported locale → pass through.
 *   2. Parse the Accept-Language header and match against supported locales.
 *   3. Fall back to the default locale when no match is found.
 */

import { NextResponse } from 'next/server';

// Inline — path aliases (@/) are not resolved in the Edge Runtime.
// Keep in sync with src/i18n/config.js.
const locales = ['en', 'ar', 'fr', 'dr'];
const defaultLocale = 'en';

/**
 * Picks the best matching locale from an Accept-Language header value.
 * Uses a simple language-tag prefix match (ignores region subtags).
 *
 * @param {import('next/server').NextRequest} request
 * @returns {string} A supported locale identifier.
 */
function detectLocale(request) {
  const acceptLanguage = request.headers.get('accept-language') ?? '';

  const preferred = acceptLanguage
    .split(',')
    .map((segment) => segment.split(';')[0].trim().toLowerCase().split('-')[0]);

  return preferred.find((lang) => locales.includes(lang)) ?? defaultLocale;
}

/**
 * Proxy entry point.
 * Redirects requests that lack a locale prefix to the correct locale URL.
 *
 * @param {import('next/server').NextRequest} request
 */
export function proxy(request) {
  const { pathname } = request.nextUrl;

  // Pass through Next.js internals, API routes, and static assets.
  const isInternal =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    /\.[\w-]+$/.test(pathname); // e.g. /favicon.ico, /robots.txt

  if (isInternal) return NextResponse.next();

  // Already locale-prefixed — nothing to do.
  const hasLocalePrefix = locales.some(
    (locale) =>
      pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (hasLocalePrefix) return NextResponse.next();

  // Redirect to the locale-prefixed equivalent.
  const locale = detectLocale(request);
  const destination = new URL(`/${locale}${pathname}`, request.url);
  destination.search = request.nextUrl.search; // preserve query string

  return NextResponse.redirect(destination);
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico   (browser icon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
