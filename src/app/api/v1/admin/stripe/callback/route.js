import { NextResponse } from 'next/server';
import { requireAdmin } from '@/middlewares/authGuard';
import { env } from '@/config/env';
import { normalizeEnvironment } from '@/lib/stripe/config';
import { getStripeClient } from '@/lib/stripe/client';
import { getStripeConnectionRow, upsertStripeConnection } from '@/lib/stripe/connection';
import { verifyState, sanitizeReturnTo } from '@/lib/stripe/oauth';
import { logger } from '@/lib/logger';

function isAuthError(err) {
  return (
    err?.statusCode === 401 ||
    err?.message?.toLowerCase().includes('unauthorized') ||
    err?.message?.toLowerCase().includes('admin access') ||
    err?.message?.toLowerCase().includes('logged in')
  );
}

function redirectBack(returnTo, result, reason) {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  const url = new URL(base + returnTo);
  url.searchParams.set('stripe', result);
  if (reason) url.searchParams.set('reason', reason);
  return NextResponse.redirect(url.toString());
}

/**
 * GET /api/v1/admin/stripe/callback
 * Stripe redirects here after the owner authorizes (or cancels). Verifies the
 * signed state + single-use nonce, exchanges the authorization code for the
 * connected account, stores it (tokens encrypted), then returns the admin to
 * the Payment settings. No secret material ever reaches the browser.
 */
export async function GET(req) {
  const url = new URL(req.url);
  const stateToken = url.searchParams.get('state');
  const payload = verifyState(stateToken);
  const returnTo = sanitizeReturnTo(payload?.returnTo);

  // Owner cancelled or Stripe returned an OAuth error.
  const oauthError = url.searchParams.get('error');
  if (oauthError) {
    const kind = oauthError === 'access_denied' ? 'cancelled' : 'error';
    return redirectBack(returnTo, kind, oauthError);
  }

  if (!payload) {
    return redirectBack(returnTo, 'error', 'invalid_state');
  }

  try {
    // The callback is a top-level browser navigation, so the admin session
    // cookie is present — re-verify authorization before storing anything.
    await requireAdmin('settings');

    const environment = normalizeEnvironment(payload.env);

    // Single-use nonce check (replay protection).
    const row = await getStripeConnectionRow();
    if (!row || row.metadata?.oauth_nonce !== payload.nonce) {
      return redirectBack(returnTo, 'error', 'state_mismatch');
    }

    const code = url.searchParams.get('code');
    if (!code) {
      return redirectBack(returnTo, 'error', 'missing_code');
    }

    const stripe = getStripeClient(environment);
    let token;
    try {
      token = await stripe.oauth.token({ grant_type: 'authorization_code', code });
    } catch (tokenErr) {
      logger.warn('stripe/callback: token exchange failed', tokenErr);
      return redirectBack(returnTo, 'error', 'token_exchange_failed');
    }

    const accountId = token?.stripe_user_id;
    if (!accountId) {
      return redirectBack(returnTo, 'error', 'no_account');
    }

    // Guard against a test/live mismatch so a live account can't be stored
    // under test config (or vice versa) — prevents accidental real charges.
    const expectedLive = environment === 'live';
    if (typeof token.livemode === 'boolean' && token.livemode !== expectedLive) {
      return redirectBack(returnTo, 'error', 'environment_mismatch');
    }

    // Best-effort account details for display; failure here is non-fatal.
    let account = null;
    try {
      account = await stripe.accounts.retrieve(accountId);
    } catch (retrieveErr) {
      logger.warn('stripe/callback: account retrieve failed (non-fatal)', retrieveErr);
    }

    const now = new Date().toISOString();
    await upsertStripeConnection({
      status: 'connected',
      stripe_account_id: accountId,
      environment,
      access_token: token.access_token ?? null,
      refresh_token: token.refresh_token ?? null,
      scope: token.scope ?? null,
      livemode: typeof token.livemode === 'boolean' ? token.livemode : expectedLive,
      account_email: account?.email ?? null,
      account_name:
        account?.business_profile?.name ??
        account?.settings?.dashboard?.display_name ??
        null,
      connected_at: now,
      last_synced_at: now,
      webhook_status: row.webhook_status ?? 'inactive',
      metadata: {
        ...(row.metadata ?? {}),
        oauth_nonce: null,
        charges_enabled: Boolean(account?.charges_enabled),
        payouts_enabled: Boolean(account?.payouts_enabled),
        details_submitted: Boolean(account?.details_submitted),
        country: account?.country ?? null,
        default_currency: account?.default_currency ?? null,
      },
    });

    return redirectBack(returnTo, 'connected');
  } catch (err) {
    if (isAuthError(err)) return redirectBack(returnTo, 'error', 'unauthorized');
    logger.error('GET /api/v1/admin/stripe/callback', err);
    return redirectBack(returnTo, 'error');
  }
}
