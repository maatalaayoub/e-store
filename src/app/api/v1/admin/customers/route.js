import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminUser } from '@/middlewares/authGuard';
import { logger } from '@/lib/logger';

/**
 * GET /api/v1/admin/customers
 *
 * Returns every non-admin user (i.e. anyone who signed up on the storefront),
 * along with lifetime order stats aggregated from the `orders` table.
 *
 * Response shape:
 *   { success: true, data: {
 *       customers: [{ id, name, email, phone, city, country, role,
 *                     joined_at, orders, spent, last_order_at }],
 *       stats: { total, new_this_month, returning, avg_order_value }
 *   } }
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Use the service-role client for the reads below: the `users` table has
    // Row Level Security that only lets each session see its own row, so an
    // admin querying with the session client would see just themselves.
    const service = createServiceClient();

    // 1) Pull every non-admin user. The schema uses role in ('client','admin'),
    //    but be tolerant of legacy 'customer' values and NULL roles too.
    const { data: users, error: usersError } = await service
      .from('users')
      .select('id, full_name, email, phone_number, address, city, country, role, created_at, is_banned')
      .or('role.is.null,role.neq.admin')
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    // 2) Pull every non-cancelled order so we can aggregate per customer in one shot.
    //    (One round-trip is much cheaper than N per-user queries.)
    const { data: orders, error: ordersError } = await service
      .from('orders')
      .select('user_id, total_amount, status, created_at')
      .neq('status', 'cancelled');

    if (ordersError) throw ordersError;

    const stats = new Map(); // user_id → { count, spent, last }
    for (const o of orders ?? []) {
      if (!o.user_id) continue;
      const s = stats.get(o.user_id) ?? { count: 0, spent: 0, last: null };
      s.count += 1;
      s.spent += Number(o.total_amount ?? 0);
      if (!s.last || new Date(o.created_at) > new Date(s.last)) s.last = o.created_at;
      stats.set(o.user_id, s);
    }

    const customers = (users ?? []).map((u) => {
      const s = stats.get(u.id) ?? { count: 0, spent: 0, last: null };
      return {
        id: u.id,
        name: u.full_name || u.email?.split('@')[0] || 'Customer',
        email: u.email ?? '',
        phone: u.phone_number ?? '',
        address: u.address ?? '',
        city: u.city ?? '',
        country: u.country ?? '',
        role: u.role ?? 'client',
        is_banned: Boolean(u.is_banned),
        joined_at: u.created_at ?? null,
        orders: s.count,
        spent: Number(s.spent.toFixed(2)),
        last_order_at: s.last,
      };
    });

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

    return NextResponse.json({
      success: true,
      data: {
        customers,
        stats: {
          total: customers.length,
          new_this_month: newThisMonth,
          returning,
          avg_order_value: Number(avgOrderValue.toFixed(2)),
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
    const adminUser = await getAdminUser(supabase);
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
