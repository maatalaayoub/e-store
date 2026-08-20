import { NextResponse } from 'next/server';
import { requireAdmin } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';
import {
  getStripeConnectionStatus,
  getStripeConnectionRow,
  upsertStripeConnection,
  clearStripeConnection,
} from '@/lib/stripe/connection';
import {
  normalizeEnvironment,
  isStripePlatformConfigured,
  getStripeAppConfig,
} from '@/lib/stripe/config';
import { getStripeClient } from '@/lib/stripe/client';
import { logger } from '@/lib/logger';

/** Map auth failures to 403 without leaking details. */
function isAuthError(err) {
  return (
    err?.statusCode === 401 ||
    err?.message?.toLowerCase().includes('unauthorized') ||
    err?.message?.toLowerCase().includes('admin access') ||
    err?.message?.toLowerCase().includes('logged in')
  );
}

function forbidden() {
  return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
}

/**
 * Builds the client-safe payload describing the current Stripe integration.
 * NEVER includes secret keys, tokens, or webhook secrets.
 */
async function buildStatusPayload() {
  const connection = await getStripeConnectionStatus();
  const env = normalizeEnvironment(connection.environment);
  const cfg = getStripeAppConfig(env);
  return {
    connection,
    platform: {
      // Whether the deployer has configured the platform credentials needed to
      // run the Connect OAuth flow for each environment. Booleans only.
      configured: {
        test: isStripePlatformConfigured('test'),
        live: isStripePlatformConfigured('live'),
      },
      // Publishable key is safe to expose (used by Stripe.js in checkout).
      publishableKey: cfg.publishableKey || '',
    },
  };
}

/**
 * GET /api/v1/admin/stripe
 * Admin only. Returns the current Stripe connection status + platform config
 * flags. No secret material is ever included.
 */
export async function GET() {
  try {
    await requireAdmin('settings');
    const data = await buildStatusPayload();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    if (isAuthError(err)) return forbidden();
    logger.error('GET /api/v1/admin/stripe', err);
    return NextResponse.json({ success: false, error: 'Failed to load Stripe status' }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/admin/stripe
 * Admin only. Sets the desired environment (test | live) BEFORE connecting.
 * Switching environments while connected is refused — the owner must
 * disconnect first so a live account is never used with test config or vice
 * versa (avoids accidental real charges).
 *
 * Body: { environment: 'test' | 'live' }
 */
export async function PATCH(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'admin-stripe', limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    await requireAdmin('settings');

    const body = await req.json().catch(() => ({}));
    const environment = normalizeEnvironment(body?.environment);

    const row = await getStripeConnectionRow();
    if (row && row.status === 'connected' && row.stripe_account_id) {
      return NextResponse.json(
        { success: false, error: 'Disconnect Stripe before switching environment.' },
        { status: 409 },
      );
    }

    if (!isStripePlatformConfigured(environment)) {
      return NextResponse.json(
        { success: false, error: `Stripe ${environment} mode is not configured on this deployment.` },
        { status: 400 },
      );
    }

    await upsertStripeConnection({ environment });
    const data = await buildStatusPayload();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    if (isAuthError(err)) return forbidden();
    logger.error('PATCH /api/v1/admin/stripe', err);
    return NextResponse.json({ success: false, error: 'Failed to update Stripe settings' }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/admin/stripe
 * Admin only. Disconnects the store's Stripe account: best-effort revokes the
 * OAuth grant on Stripe, then clears all stored credentials and marks the
 * connection revoked. Historical orders/payments are never touched.
 */
export async function DELETE(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'admin-stripe', limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    await requireAdmin('settings');

    const row = await getStripeConnectionRow();
    if (!row || row.status !== 'connected' || !row.stripe_account_id) {
      // Idempotent: already disconnected.
      await clearStripeConnection('disconnected');
      const data = await buildStatusPayload();
      return NextResponse.json({ success: true, data });
    }

    const environment = normalizeEnvironment(row.environment);
    // Best-effort revoke on Stripe. A failure here (already revoked, network,
    // missing platform config) must not block clearing our own record.
    try {
      const cfg = getStripeAppConfig(environment);
      if (cfg.clientId && cfg.secretKey) {
        const stripe = getStripeClient(environment);
        await stripe.oauth.deauthorize({
          client_id: cfg.clientId,
          stripe_user_id: row.stripe_account_id,
        });
      }
    } catch (revokeErr) {
      logger.warn('DELETE /api/v1/admin/stripe: Stripe deauthorize failed (continuing)', revokeErr);
    }

    await clearStripeConnection('disconnected');
    const data = await buildStatusPayload();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    if (isAuthError(err)) return forbidden();
    logger.error('DELETE /api/v1/admin/stripe', err);
    return NextResponse.json({ success: false, error: 'Failed to disconnect Stripe' }, { status: 500 });
  }
}
