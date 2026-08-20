import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/middlewares/authGuard';
import { rateLimitOrReject } from '@/lib/request-guard';
import { env } from '@/config/env';
import { normalizeEnvironment, isStripePlatformConfigured } from '@/lib/stripe/config';
import { getStripeConnectionRow, upsertStripeConnection } from '@/lib/stripe/connection';
import { signState, buildAuthorizeUrl, sanitizeReturnTo } from '@/lib/stripe/oauth';
import { logger } from '@/lib/logger';

function isAuthError(err) {
  return (
    err?.statusCode === 401 ||
    err?.message?.toLowerCase().includes('unauthorized') ||
    err?.message?.toLowerCase().includes('admin access') ||
    err?.message?.toLowerCase().includes('logged in')
  );
}

/** Redirect back to the admin settings with a stripe result/reason. */
function redirectBack(returnTo, result, reason) {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  const url = new URL(base + returnTo);
  url.searchParams.set('stripe', result);
  if (reason) url.searchParams.set('reason', reason);
  return NextResponse.redirect(url.toString());
}

/**
 * GET /api/v1/admin/stripe/connect
 * Admin only. Starts the Stripe Connect OAuth flow: validates the platform is
 * configured for the chosen environment, persists a single-use nonce, then
 * redirects the browser to Stripe's authorization page with a signed state.
 *
 * Query: environment=test|live, returnTo=<same-origin path>
 */
export async function GET(req) {
  const url = new URL(req.url);
  const environment = normalizeEnvironment(url.searchParams.get('environment'));
  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));

  const limited = await rateLimitOrReject(req, { bucket: 'admin-stripe-connect', limit: 15, windowMs: 60_000 });
  if (limited) return limited;

  try {
    await requireAdmin('settings');

    if (!isStripePlatformConfigured(environment)) {
      return redirectBack(returnTo, 'error', 'not_configured');
    }

    // Single-use nonce, stored server-side and echoed inside the signed state.
    const nonce = crypto.randomUUID();
    const existing = await getStripeConnectionRow();
    await upsertStripeConnection({
      environment,
      metadata: { ...(existing?.metadata ?? {}), oauth_nonce: nonce },
    });

    const state = signState({ env: environment, nonce, returnTo });
    const authorizeUrl = buildAuthorizeUrl({ environment, state });
    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    if (isAuthError(err)) return redirectBack(returnTo, 'error', 'unauthorized');
    logger.error('GET /api/v1/admin/stripe/connect', err);
    return redirectBack(returnTo, 'error');
  }
}
