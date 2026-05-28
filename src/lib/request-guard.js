/**
 * Shared request guards for mutating API routes.
 *
 * - {@link assertSameOrigin} blocks classic CSRF: a cross-site form/fetch
 *   targeting our state-changing endpoints with the user's cookies attached.
 *   Same-origin checks via Origin / Referer headers are the OWASP-recommended
 *   primary defence for SameSite=Lax cookies.
 *
 * - {@link rateLimitOrReject} bundles `rateLimit` + a 429 NextResponse so
 *   route handlers don't repeat the boilerplate.
 */

import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * @param {Request} req
 * @returns {NextResponse | null} A 403 response if the origin is foreign, else null.
 */
export function assertSameOrigin(req) {
  // Skip in test/development unless explicitly enforced so local tooling
  // (curl, Postman, Storybook) still works.
  if (process.env.NODE_ENV !== 'production' && process.env.ENFORCE_SAME_ORIGIN !== '1') {
    return null;
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');
  if (!host) {
    return NextResponse.json(
      { success: false, error: 'Bad request' },
      { status: 400 },
    );
  }

  const candidates = [origin, referer].filter(Boolean);
  // If neither header is present, reject — modern browsers always send at
  // least one for cross-origin requests; server-to-server callers should
  // use a token-based API and not the cookie auth layer.
  if (candidates.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 },
    );
  }

  for (const value of candidates) {
    let url;
    try { url = new URL(value); } catch { return rejectForbidden(); }
    if (url.host !== host) return rejectForbidden();
  }
  return null;
}

function rejectForbidden() {
  return NextResponse.json(
    { success: false, error: 'Forbidden' },
    { status: 403 },
  );
}

/**
 * @param {Request} req
 * @param {{ bucket: string, limit: number, windowMs: number }} opts
 * @returns {Promise<NextResponse | null>} A 429 response if exceeded, else null.
 */
export async function rateLimitOrReject(req, { bucket, limit, windowMs }) {
  const ip = getClientIp(req) || 'unknown';
  const { success, remaining, reset } = await rateLimit(
    `${bucket}:${ip}`,
    { limit, windowMs },
  );
  if (success) return null;
  const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    { success: false, error: 'Too many requests' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Remaining': String(remaining),
      },
    },
  );
}
