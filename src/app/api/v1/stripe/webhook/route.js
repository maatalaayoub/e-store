import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getStripeAppConfig } from '@/lib/stripe/config';
import { getStripeClient } from '@/lib/stripe/client';
import { upsertStripeConnection } from '@/lib/stripe/connection';
import { logger } from '@/lib/logger';

// Stripe signature verification needs the raw request body and Node crypto.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verify the payload against whichever environment's webhook secret is
 * configured. A deployment may run test or live (or both), and we can't know
 * which until the signature matches — so we try each configured secret.
 */
function verifyEvent(rawBody, signature) {
  for (const environment of ['test', 'live']) {
    const cfg = getStripeAppConfig(environment);
    if (!cfg.secretKey || !cfg.webhookSecret) continue;
    try {
      const stripe = getStripeClient(environment);
      const event = stripe.webhooks.constructEvent(rawBody, signature, cfg.webhookSecret);
      return { event, environment };
    } catch {
      // Signature didn't match this environment's secret — try the next.
    }
  }
  return null;
}

/**
 * Apply a payment status transition to an order, guarding against invalid
 * downgrades (e.g. a late "failed" event must never override a "paid"/"refunded"
 * order). Optionally records the resolved PaymentIntent id.
 */
async function applyPaymentStatus(db, { orderId, paymentIntentId, next }) {
  if (!orderId || !UUID_RE.test(orderId)) return;

  const { data: order } = await db
    .from('orders')
    .select('id, payment_status')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return;

  const current = order.payment_status ?? 'unpaid';

  // Terminal/priority states that later, lower-priority events can't override.
  const locked = {
    paid: ['failed', 'cancelled', 'pending'],
    refunded: ['paid', 'failed', 'cancelled', 'pending'],
  };
  if (locked[current]?.includes(next)) return;
  if (current === next && !paymentIntentId) return;

  const update = { payment_status: next };
  if (paymentIntentId && typeof paymentIntentId === 'string') {
    update.stripe_payment_intent_id = paymentIntentId;
  }
  await db.from('orders').update(update).eq('id', orderId);
}

/** Resolve the order id from an object's metadata, falling back to null. */
function orderIdFromMetadata(obj) {
  const id = obj?.metadata?.order_id;
  return typeof id === 'string' && UUID_RE.test(id) ? id : null;
}

/**
 * POST /api/v1/stripe/webhook
 * Receives Stripe (Connect) events. Verifies the signature, dedups by event id,
 * and updates order payment status from verified events only. Always returns
 * 200 for accepted/duplicate events so Stripe stops retrying; returns 400 only
 * when the signature is invalid.
 */
export async function POST(req) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  let rawBody;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  const verified = verifyEvent(rawBody, signature);
  if (!verified) {
    // Invalid signature — reject so it is not silently accepted.
    return NextResponse.json({ received: false, error: 'invalid_signature' }, { status: 400 });
  }

  const { event } = verified;
  const db = createServiceClient();

  // Idempotency: record the event id first. A duplicate delivery (unique
  // violation) is acknowledged without reprocessing.
  try {
    const { error: insErr } = await db
      .from('stripe_events')
      .insert({ id: event.id, type: event.type, account_id: event.account ?? null });
    if (insErr) {
      if (insErr.code === '23505') {
        return NextResponse.json({ received: true, duplicate: true });
      }
      // Table missing or transient error — log and continue (best-effort).
      logger.warn('stripe/webhook: event ledger insert failed', insErr);
    }
  } catch (err) {
    logger.warn('stripe/webhook: event ledger insert threw', err);
  }

  // Mark the connection's webhook as active on first verified delivery.
  try {
    await upsertStripeConnection({ webhook_status: 'active', last_synced_at: new Date().toISOString() });
  } catch (err) {
    logger.logSwallowed('stripe/webhook: webhook_status update', err);
  }

  try {
    const obj = event.data?.object ?? {};
    switch (event.type) {
      case 'checkout.session.completed': {
        // Only a fully paid session marks the order paid.
        if (obj.payment_status === 'paid' || obj.status === 'complete') {
          await applyPaymentStatus(db, {
            orderId: orderIdFromMetadata(obj) ?? (obj.client_reference_id ?? null),
            paymentIntentId: typeof obj.payment_intent === 'string' ? obj.payment_intent : null,
            next: 'paid',
          });
        }
        break;
      }
      case 'checkout.session.async_payment_succeeded':
      case 'payment_intent.succeeded': {
        await applyPaymentStatus(db, {
          orderId: orderIdFromMetadata(obj) ?? (obj.client_reference_id ?? null),
          paymentIntentId: obj.id && obj.object === 'payment_intent' ? obj.id
            : (typeof obj.payment_intent === 'string' ? obj.payment_intent : null),
          next: 'paid',
        });
        break;
      }
      case 'checkout.session.async_payment_failed':
      case 'payment_intent.payment_failed': {
        await applyPaymentStatus(db, {
          orderId: orderIdFromMetadata(obj) ?? (obj.client_reference_id ?? null),
          next: 'failed',
        });
        break;
      }
      case 'payment_intent.canceled':
      case 'checkout.session.expired': {
        await applyPaymentStatus(db, {
          orderId: orderIdFromMetadata(obj) ?? (obj.client_reference_id ?? null),
          next: 'cancelled',
        });
        break;
      }
      case 'charge.refunded': {
        // Charges don't carry our order metadata — match by PaymentIntent id.
        const pi = typeof obj.payment_intent === 'string' ? obj.payment_intent : null;
        let orderId = orderIdFromMetadata(obj);
        if (!orderId && pi) {
          const { data: match } = await db
            .from('orders')
            .select('id')
            .eq('stripe_payment_intent_id', pi)
            .maybeSingle();
          orderId = match?.id ?? null;
        }
        await applyPaymentStatus(db, { orderId, next: 'refunded' });
        break;
      }
      default:
        // Unhandled event types are acknowledged and ignored.
        break;
    }
  } catch (err) {
    logger.error('stripe/webhook: processing error', err);
    // Still 200 so Stripe doesn't hammer retries for a persistent app bug;
    // the event is already recorded and can be reconciled manually.
    return NextResponse.json({ received: true, processed: false });
  }

  return NextResponse.json({ received: true });
}
