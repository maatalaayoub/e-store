import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminUser } from '@/middlewares/authGuard';
import { logger } from '@/lib/logger';
import { buildCustomerClusters } from '@/lib/customer-dedupe';

/**
 * GET /api/v1/admin/customers
 *
 * Returns a *deduplicated* list of every person the store has seen — both
 * registered users AND guest checkouts (orders whose user_id IS NULL). The
 * same physical customer is merged into a single row even if they used
 * slightly different names, emails or phone numbers between orders. See
 * `src/lib/customer-dedupe.js` for the identity-resolution rules.
 *
 * Response shape:
 *   { success: true, data: {
 *       customers: [{
 *         id, kind ('user'|'guest'), name, email, phone, address, city, country,
 *         role, is_banned, joined_at, orders, spent, last_order_at,
 *         signals, guest_orders
 *       }],
 *       stats: { total, new_this_month, returning, avg_order_value,
 *                guests, registered }
 *   } }
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase, 'customers');
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Use the service-role client for the reads below: the `users` table has
    // Row Level Security that only lets each session see its own row, so an
    // admin querying with the session client would see just themselves.
    const service = createServiceClient();

    // Fetch users, all orders (registered + guest), and user_devices in
    // parallel — dedupe is done in memory afterwards.
    const [usersRes, ordersRes, devicesRes] = await Promise.all([
      service
        .from('users')
        .select(
          'id, full_name, email, phone_number, address, city, country, role, created_at, is_banned, banned_reason'
        )
        .or('role.is.null,role.neq.admin'),
      service
        .from('orders')
        .select('id, user_id, total_amount, status, created_at, shipping_address, device_id')
        .order('created_at', { ascending: false }),
      service.from('user_devices').select('user_id, device_id'),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (ordersRes.error) throw ordersRes.error;
    // user_devices may not have any rows yet — swallow "does not exist" softly.
    const devices = devicesRes.error ? [] : devicesRes.data ?? [];

    // The `orders.device_id` column may not exist yet (migration pending).
    // Supabase returns the rows without the column rather than erroring, so
    // the field is simply undefined — nothing to do.
    const clusters = buildCustomerClusters({
      users: usersRes.data ?? [],
      orders: ordersRes.data ?? [],
      devices,
    });

    // Sort: most recently active first, then newest joined.
    clusters.sort((a, b) => {
      const la = a.last_order_at ? new Date(a.last_order_at).getTime() : 0;
      const lb = b.last_order_at ? new Date(b.last_order_at).getTime() : 0;
      if (lb !== la) return lb - la;
      const ja = a.joined_at ? new Date(a.joined_at).getTime() : 0;
      const jb = b.joined_at ? new Date(b.joined_at).getTime() : 0;
      return jb - ja;
    });

    // Strip cluster-internal fields we don't need to send to the browser.
    const customers = clusters.map((c) => ({
      id: c.id,
      kind: c.kind,
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      city: c.city,
      country: c.country,
      role: c.role,
      is_banned: c.is_banned,
      joined_at: c.joined_at,
      orders: c.orders,
      spent: c.spent,
      last_order_at: c.last_order_at,
      signals: c.signals,
      guest_orders: c.guest_orders,
    }));

    // Aggregate stat cards.
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = customers.filter(
      (c) => c.joined_at && new Date(c.joined_at) >= startOfThisMonth
    ).length;
    const returning = customers.filter((c) => c.orders > 1).length;
    const totalOrders = customers.reduce((s, c) => s + c.orders, 0);
    const totalSpent = customers.reduce((s, c) => s + c.spent, 0);
    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const guests = customers.filter((c) => c.kind === 'guest').length;

    return NextResponse.json({
      success: true,
      data: {
        customers,
        stats: {
          total: customers.length,
          new_this_month: newThisMonth,
          returning,
          avg_order_value: Number(avgOrderValue.toFixed(2)),
          guests,
          registered: customers.length - guests,
        },
      },
    });
  } catch (err) {
    logger.error('GET /api/v1/admin/customers', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/customers
 *
 * Admin-only. Creates a new Supabase auth user (email-confirmed so they can
 * sign in immediately) and populates the matching `public.users` row with
 * profile fields provided in the request.
 *
 * Body: {
 *   email: string (required)
 *   password: string (required, min 6)
 *   full_name?: string
 *   phone_number?: string
 *   address?: string
 *   city?: string
 *   country?: string
 * }
 */
export async function POST(req) {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase, 'customers');
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const phoneNumber = typeof body.phone_number === 'string' ? body.phone_number.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const city = typeof body.city === 'string' ? body.city.trim() : '';
    const country = typeof body.country === 'string' ? body.country.trim() : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'A valid email is required' },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const service = createServiceClient();

    // Create the auth user with email already confirmed so no verification
    // email is required — the admin created this account manually.
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      const msg = createError.message || 'Failed to create customer';
      const status = /already/i.test(msg) ? 409 : 400;
      return NextResponse.json({ success: false, error: msg }, { status });
    }

    const newUserId = created.user?.id;
    if (!newUserId) {
      return NextResponse.json(
        { success: false, error: 'Failed to create customer' },
        { status: 500 }
      );
    }

    // The `handle_new_user` trigger inserts a row into public.users with the
    // basic fields — upsert to fill in the extra ones. Force role='client'
    // so admins can never accidentally provision another admin from here.
    const { error: profileError } = await service.from('users').upsert(
      {
        id: newUserId,
        email,
        full_name: fullName || null,
        phone_number: phoneNumber || null,
        address: address || null,
        city: city || null,
        country: country || null,
        role: 'client',
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      logger.error('POST /api/v1/admin/customers profile upsert', profileError);
    }

    return NextResponse.json({ success: true, data: { id: newUserId } });
  } catch (err) {
    logger.error('POST /api/v1/admin/customers', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}
