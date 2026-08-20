import { NextResponse } from 'next/server';
import { requireAdmin } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';
import {
  getStripeConnectionRow,
  getStripeConnectionStatus,
  upsertStripeConnection,
} from '@/lib/stripe/connection';
import { normalizeEnvironment } from '@/lib/stripe/config';
import { getStripeClient } from '@/lib/stripe/client';
import { logger } from '@/lib/logger';

function isAuthError(err) {
  return (
    err?.statusCode === 401 ||
    err?.message?.toLowerCase().includes('unauthorized') ||
    err?.message?.toLowerCase().includes('admin access') ||
    err?.message?.toLowerCase().includes('logged in')
  );
}

/**
 * POST /api/v1/admin/stripe/test
 * Admin only. Verifies the stored Stripe connection is still valid by
 * retrieving the connected account from Stripe. On success, refreshes the
 * cached account details, marks the webhook status, and stamps last_synced_at.
 * On failure, records the connection as errored so the UI can surface it.
 *
 * Returns only sanitized status — never tokens or secret keys.
 */
export async function POST(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'admin-stripe-test', limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    await requireAdmin('settings');

    const row = await getStripeConnectionRow();
    if (!row || row.status !== 'connected' || !row.stripe_account_id) {
      return NextResponse.json(
        { success: false, error: 'not_connected' },
        { status: 409 },
      );
    }

    const environment = normalizeEnvironment(row.environment);
    let account;
    try {
      const stripe = getStripeClient(environment);
      account = await stripe.accounts.retrieve(row.stripe_account_id);
    } catch (stripeErr) {
      logger.warn('POST /api/v1/admin/stripe/test: retrieve failed', stripeErr);
      await upsertStripeConnection({ status: 'error', webhook_status: 'error' });
      const data = await getStripeConnectionStatus();
      return NextResponse.json(
        { success: false, error: 'connection_invalid', data },
        { status: 502 },
      );
    }

    // Guard against a test/live mismatch between the stored environment and the
    // account Stripe returns, so the owner can't accidentally run live charges.
    if (typeof account?.livemode === 'boolean') {
      const expectedLive = environment === 'live';
      if (account.livemode !== expectedLive) {
        await upsertStripeConnection({ status: 'error' });
        const data = await getStripeConnectionStatus();
        return NextResponse.json(
          { success: false, error: 'environment_mismatch', data },
          { status: 409 },
        );
      }
    }

    await upsertStripeConnection({
      status: 'connected',
      livemode: typeof account?.livemode === 'boolean' ? account.livemode : environment === 'live',
      account_email: account?.email ?? row.account_email ?? null,
      account_name:
        account?.business_profile?.name ??
        account?.settings?.dashboard?.display_name ??
        row.account_name ??
        null,
      webhook_status: 'active',
      last_synced_at: new Date().toISOString(),
      metadata: {
        ...(row.metadata ?? {}),
        charges_enabled: Boolean(account?.charges_enabled),
        payouts_enabled: Boolean(account?.payouts_enabled),
        details_submitted: Boolean(account?.details_submitted),
        country: account?.country ?? null,
        default_currency: account?.default_currency ?? null,
      },
    });

    const data = await getStripeConnectionStatus();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    if (isAuthError(err)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    logger.error('POST /api/v1/admin/stripe/test', err);
    return NextResponse.json({ success: false, error: 'Failed to test Stripe connection' }, { status: 500 });
  }
}
