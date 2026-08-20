import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';
import { env } from '@/config/env';
import { locales, defaultLocale } from '@/i18n/config';
import { STORE_ID, normalizeEnvironment } from '@/lib/stripe/config';
import { getStripeConnectionRow } from '@/lib/stripe/connection';
import { getStripeClient } from '@/lib/stripe/client';
import { toStripeMinorUnits } from '@/lib/stripe/amount';
import { logger } from '@/lib/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeLocale(value) {
  return locales.includes(value) ? value : defaultLocale;
}

/**
 * POST /api/v1/orders/[id]/pay
 * Public (guest checkout). Creates a Stripe Checkout Session on the store's
 * CONNECTED account for an existing order, using the server-computed order
 * total in the canonical base currency (MAD) — client-supplied prices/totals
 * are never trusted. Returns the hosted Checkout URL to redirect to.
 *
 * The order is only marked `paid` later, by the verified webhook — reaching
 * the success page never marks an order paid.
 */
export async function POST(req, { params }) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'orders-pay', limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const locale = safeLocale(body?.locale);

    const db = createServiceClient();
    const { data: order, error } = await db
      .from('orders')
      .select('id, order_number, total_amount, currency_code, status, payment_status')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    if (order.status === 'cancelled') {
      return NextResponse.json({ success: false, error: 'order_cancelled' }, { status: 409 });
    }
    if (order.payment_status === 'paid') {
      return NextResponse.json({ success: false, error: 'already_paid' }, { status: 409 });
    }

    // Verify this store has a live Stripe connection.
    const connection = await getStripeConnectionRow();
    if (!connection || connection.status !== 'connected' || !connection.stripe_account_id) {
      return NextResponse.json({ success: false, error: 'stripe_unavailable' }, { status: 409 });
    }

    const environment = normalizeEnvironment(connection.environment);

    // total_amount is the canonical, server-computed amount stored in MAD.
    const amount = toStripeMinorUnits(order.total_amount, 'MAD');
    if (amount <= 0) {
      return NextResponse.json({ success: false, error: 'invalid_amount' }, { status: 400 });
    }

    const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
    const successUrl = `${base}/${locale}/order-confirmed?id=${order.id}&paid=1`;
    const cancelUrl = `${base}/${locale}/checkout?canceled=1`;

    const metadata = {
      order_id: order.id,
      order_number: String(order.order_number ?? ''),
      store_id: STORE_ID,
    };

    let session;
    try {
      const stripe = getStripeClient(environment);
      session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: 'mad',
                product_data: { name: `Order #${order.order_number ?? order.id}` },
                unit_amount: amount,
              },
              quantity: 1,
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
          client_reference_id: order.id,
          metadata,
          payment_intent_data: { metadata },
        },
        { stripeAccount: connection.stripe_account_id },
      );
    } catch (stripeErr) {
      logger.error('orders/[id]/pay: Stripe session create failed', stripeErr);
      return NextResponse.json({ success: false, error: 'payment_init_failed' }, { status: 502 });
    }

    // Record the pending payment. The webhook later flips this to paid/failed
    // and replaces the reference with the resolved PaymentIntent id.
    await db
      .from('orders')
      .update({
        payment_method: 'stripe',
        payment_status: 'pending',
        stripe_payment_intent_id:
          typeof session.payment_intent === 'string' ? session.payment_intent : session.id,
      })
      .eq('id', order.id);

    return NextResponse.json({ success: true, data: { url: session.url } });
  } catch (err) {
    logger.error('POST /api/v1/orders/[id]/pay', err);
    return NextResponse.json({ success: false, error: 'Failed to start payment' }, { status: 500 });
  }
}
