import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendTelegramMessage, buildOrderMessage } from '@/lib/telegram';

async function getAdminUser(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? user : null;
}

/**
 * POST /api/v1/orders
 * Create a new order (available to anyone — supports guest checkout).
 * Body: { shipping, items, total_mad, currency_code, exchange_rate }
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { shipping, items, total_mad, currency_code, exchange_rate } = body;

    if (!shipping || !Array.isArray(items) || items.length === 0 || total_mad == null) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: shipping, items, total_mad' },
        { status: 400 }
      );
    }

    // Try to get current user id (null for guests, or if auth call fails)
    let userId = null;
    try {
      const sessionClient = await createClient();
      const { data: { user } } = await sessionClient.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }

    // Use service client to bypass RLS — guests can create orders too
    const db = createServiceClient();

    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({
        user_id: userId,
        status: 'pending',
        total_amount: total_mad,
        currency_code: currency_code ?? 'MAD',
        exchange_rate: exchange_rate ?? 1,
        shipping_address: shipping,
      })
      .select('id')
      .single();

    if (orderErr) throw orderErr;

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.unit_price_mad,
    }));

    const { error: itemsErr } = await db.from('order_items').insert(orderItems);
    if (itemsErr) throw itemsErr;

    // Respond immediately — notification runs fully fire-and-forget
    const response = NextResponse.json({ success: true, data: { id: order.id } }, { status: 201 });

    // Build + send Telegram notification (never blocks or breaks the order)
    ;(async () => {
      try {
        const { data: products } = await db
          .from('products')
          .select('id, name')
          .in('id', items.map((i) => i.id));
        const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p.name]));

        const message = buildOrderMessage({
          id: order.id.slice(0, 8).toUpperCase(),
          customerName: shipping.full_name || 'Guest',
          phone: shipping.phone ?? '',
          address: shipping.address ?? '',
          city: shipping.city ?? '',
          country: shipping.country ?? '',
          items: items.map((item) => ({
            name: productMap[item.id] ?? `Product #${item.id.slice(0, 6)}`,
            qty: item.quantity,
            price: `${item.unit_price_mad} MAD`,
          })),
          total: total_mad,
          currency: currency_code ?? 'MAD',
        });
        await sendTelegramMessage(message);
      } catch { /* notification errors must never surface */ }
    })();

    return response;
  } catch (err) {
    console.error('[POST /api/v1/orders]', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create order',
        details: err?.message ?? String(err),
        code: err?.code,
        hint: err?.hint,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/orders
 * List all orders — admin only.
 * Returns orders with items, product names, and shipping address.
 */
export async function GET() {
  try {
    const anonClient = await createClient();
    const adminUser = await getAdminUser(anonClient);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { data: orders, error } = await anonClient
      .from('orders')
      .select(`
        id,
        status,
        cancelled_by,
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
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: orders });
  } catch (err) {
    console.error('[GET /api/v1/orders]', err?.message ?? err);
    return NextResponse.json({ success: false, error: 'Failed to fetch orders' }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/orders
 * - Admin: can update any order to any valid status.
 * - Authenticated user: can cancel their own pending order only.
 * Body: { id, status }
 */
export async function PATCH(req) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status } = await req.json();
    const allowed = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!id || !allowed.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid id or status' }, { status: 400 });
    }

    // Check if user is admin
    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const isAdmin = userData?.role === 'admin';

    if (isAdmin) {
      // Admin can set any status
      const update = { status };
      if (status === 'cancelled') update.cancelled_by = 'admin';
      else update.cancelled_by = null;
      const { data: updated, error } = await supabase.from('orders').update(update).eq('id', id).select('id');
      if (error) throw error;
      if (!updated?.length) throw new Error('Update blocked — check RLS policies');
      return NextResponse.json({ success: true });
    }

    // Non-admin: can only cancel their own pending order
    if (status !== 'cancelled') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, status, user_id')
      .eq('id', id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    if (order.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (order.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Only pending orders can be cancelled' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', cancelled_by: 'customer' })
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!updated?.length) throw new Error('Update blocked — check RLS policies on orders table');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/v1/orders]', err?.message ?? err);
    return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 });
  }
}
