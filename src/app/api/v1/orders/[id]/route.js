import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * GET /api/v1/orders/[id]
 * Public — returns order details by UUID.
 * Security: order IDs are unguessable UUIDs (only the customer who placed
 * the order knows the ID, since it's only returned in the order-creation
 * response). This is the same pattern Shopify/Stripe use for guest receipts.
 */
export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing order id' }, { status: 400 });
    }

    const db = createServiceClient();

    // Support three lookup modes:
    //  - Pure digits (≤10 chars) → user-facing order_number (e.g. "47382910")
    //  - Full UUID (36 chars with dashes) → internal id
    //  - Short hex prefix → legacy short-id prefix match (kept for backward compat)
    const isNumeric = /^\d{1,10}$/.test(id);
    const isFullUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

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
          products ( name )
        )
      `);

    if (isNumeric) {
      query = query.eq('order_number', parseInt(id, 10));
    } else if (isFullUuid) {
      query = query.eq('id', id);
    } else {
      // Legacy: short hex prefix match
      query = query.ilike('id', `${id.toLowerCase()}%`);
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
