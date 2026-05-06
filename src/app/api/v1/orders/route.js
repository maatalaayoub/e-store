import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendTelegramMessage, buildOrderMessage } from '@/lib/telegram';
import { getAdminUser } from '@/middlewares/authGuard';

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

    // Generate a random 8-digit order number; retry up to 5 times on collision
    const randomOrderNumber = () => Math.floor(10000000 + Math.random() * 90000000);

    let order, orderErr;
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await db
        .from('orders')
        .insert({
          user_id: userId,
          status: 'pending',
          total_amount: total_mad,
          currency_code: currency_code ?? 'MAD',
          exchange_rate: exchange_rate ?? 1,
          shipping_address: shipping,
          order_number: randomOrderNumber(),
        })
        .select('id, order_number')
        .single();

      // 23505 = unique_violation — try a different number
      if (!result.error || result.error.code !== '23505') {
        order = result.data;
        orderErr = result.error;
        break;
      }
    }

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
    const response = NextResponse.json({ success: true, data: { id: order.id, order_number: order.order_number } }, { status: 201 });

    // Build + send Telegram notification (never blocks or breaks the order)
    ;(async () => {
      try {
        const { data: products } = await db
          .from('products')
          .select('id, name')
          .in('id', items.map((i) => i.id));
        const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p.name]));

        const message = buildOrderMessage({
          id: String(order.order_number),
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
    console.error('[POST /api/v1/orders]', err?.message ?? err);
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
 * Admin only.
 *
 * Single-order detail (existing usage):
 *   GET /api/v1/orders?id=<uuid>
 *
 * List with pagination + filters + sort:
 *   GET /api/v1/orders?page=1&limit=25&status=pending&sort=created_at:desc
 *
 * Query params (all optional):
 *   - page    (default 1, min 1)
 *   - limit   (default 25, max 100)
 *   - status  (one of the allowed statuses; omitted = all)
 *   - sort    `<field>:<asc|desc>` — field ∈ created_at | total_amount | order_number | status
 *
 * Backwards compatibility: when none of `page`, `limit`, `status`, `sort`
 * are provided we keep the legacy unpaginated response shape (`{ data: [] }`)
 * but cap the result at `LIST_HARD_MAX` rows so the table can't blow up
 * memory once the order volume grows.
 */

const LIST_DEFAULT_LIMIT = 25;
const LIST_MAX_LIMIT = 100;
const LIST_HARD_MAX = 500; // safety cap for the legacy unpaginated mode
const SORTABLE_FIELDS = new Set(['created_at', 'total_amount', 'order_number', 'status']);
const ALLOWED_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export async function GET(req) {
  try {
    const anonClient = await createClient();
    const adminUser = await getAdminUser(anonClient);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // List query — only the fields needed to render the table/cards
    const listFields = `
      id,
      order_number,
      status,
      cancelled_by,
      total_amount,
      currency_code,
      exchange_rate,
      created_at,
      shipping_address
    `;

    // Detail query — includes full item breakdown (only fetched on click)
    const detailFields = `
      id,
      order_number,
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
    `;

    if (id) {
      const { data, error } = await anonClient
        .from('orders')
        .select(detailFields)
        .eq('id', id)
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // ── Parse pagination / filter / sort params ─────────────────────────
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const statusParam = searchParams.get('status');
    const sortParam = searchParams.get('sort');

    const isPaginated =
      pageParam != null || limitParam != null || statusParam != null || sortParam != null;

    const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
    const limit = Math.min(
      LIST_MAX_LIMIT,
      Math.max(1, parseInt(limitParam ?? String(LIST_DEFAULT_LIMIT), 10) || LIST_DEFAULT_LIMIT),
    );

    let sortField = 'created_at';
    let sortAsc = false;
    if (sortParam) {
      const [f, dir] = sortParam.split(':');
      if (SORTABLE_FIELDS.has(f)) sortField = f;
      if (dir === 'asc') sortAsc = true;
    }

    let query = anonClient
      .from('orders')
      .select(listFields, isPaginated ? { count: 'exact' } : undefined)
      .order(sortField, { ascending: sortAsc });

    if (statusParam && ALLOWED_STATUSES.includes(statusParam)) {
      query = query.eq('status', statusParam);
    }

    if (isPaginated) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    } else {
      query = query.range(0, LIST_HARD_MAX - 1);
    }

    const { data: orders, error, count } = await query;
    if (error) throw error;

    if (!isPaginated) {
      // Legacy shape — preserves existing admin client behavior.
      return NextResponse.json({ success: true, data: orders ?? [] });
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return NextResponse.json({
      success: true,
      data: orders ?? [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
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
    const allowed = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
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
