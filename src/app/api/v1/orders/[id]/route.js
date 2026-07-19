import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * GET /api/v1/orders/[id]
 * Public — returns order details by UUID or by 8-digit order_number.
 *
 * Security model: order IDs are unguessable UUIDs (the customer who placed
 * the order is the only party who knows them, since they're only returned
 * in the order-creation response). Numeric `order_number` lookups exist
 * for the guest "track order" page; they are rate-limited per IP via the
 * shared limiter (Upstash Redis when configured, in-memory fallback
 * otherwise) to mitigate enumeration of the ~10^8 numeric space.
 */

const NUMERIC_LOOKUP_LIMIT = 30;
const NUMERIC_LOOKUP_WINDOW_MS = 60_000;

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing order id' }, { status: 400 });
    }

    const isFullUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isNumeric = /^\d{6,10}$/.test(id);

    // Reject anything else outright. The legacy "short hex prefix" lookup
    // (ilike '<prefix>%') was removed because just 16 single-character
    // queries could enumerate the entire table.
    if (!isFullUuid && !isNumeric) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Numeric (order_number) lookups are guessable — apply a per-IP brake.
    if (isNumeric) {
      const ip = getClientIp(req);
      const { success, reset } = await rateLimit(`order-lookup:${ip ?? 'unknown'}`, {
        limit: NUMERIC_LOOKUP_LIMIT,
        windowMs: NUMERIC_LOOKUP_WINDOW_MS,
      });
      if (!success) {
        const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        return NextResponse.json(
          { success: false, error: 'Too many requests. Please try again in a minute.' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        );
      }
    }

    const db = createServiceClient();
    let query = db
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        total_amount,
        currency_code,
        exchange_rate,
        created_at,
        shipping_address,
        order_items (
          quantity,
          unit_price,
          selected_color,
          selected_size,
          products (
            name,
            product_images ( url, is_main )
          )
        )
      `);

    if (isFullUuid) {
      query = query.eq('id', id);
    } else {
      query = query.eq('order_number', parseInt(id, 10));
    }

    const { data: order, error } = await query.maybeSingle();

    if (error) throw error;
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (err) {
    console.error('[GET /api/v1/orders/[id]]', err?.message ?? err);
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 });
  }
}
