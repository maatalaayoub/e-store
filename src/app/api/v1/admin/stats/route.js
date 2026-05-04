import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getAdminUser(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? user : null;
}

/**
 * GET /api/v1/admin/stats
 * Returns dashboard overview stats + recent products.
 * Admin only.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Run all queries in parallel
    const [ordersRes, productsRes, customersRes, recentProductsRes] = await Promise.all([
      // All orders — for revenue + count
      supabase
        .from('orders')
        .select('id, total_amount, status, created_at'),

      // All products — for count (all statuses)
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true }),

      // Active customers (users with at least one order, or just total users)
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer'),

      // Recent 5 products for table
      supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          status,
          stock,
          categories ( name )
        `)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    if (ordersRes.error) throw ordersRes.error;
    if (productsRes.error) throw productsRes.error;
    if (customersRes.error) throw customersRes.error;
    if (recentProductsRes.error) throw recentProductsRes.error;

    const orders = ordersRes.data ?? [];

    // Revenue: sum of all non-cancelled orders
    const totalRevenue = orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);

    // This month vs last month helpers
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

    const thisMonthOrders = orders.filter((o) => new Date(o.created_at).getTime() >= startOfThisMonth);
    const lastMonthOrders = orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= startOfLastMonth && t < startOfThisMonth;
    });

    const thisMonthRevenue = thisMonthOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
    const lastMonthRevenue = lastMonthOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

    function pct(current, previous) {
      if (previous === 0) return current > 0 ? '+100.0%' : '—';
      const change = ((current - previous) / previous) * 100;
      return (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
    }

    const stats = {
      revenue: {
        value: totalRevenue.toFixed(2),
        trend: pct(thisMonthRevenue, lastMonthRevenue),
      },
      orders: {
        value: orders.length,
        trend: pct(thisMonthOrders.length, lastMonthOrders.length),
      },
      products: {
        value: productsRes.count ?? 0,
        trend: null,
      },
      customers: {
        value: customersRes.count ?? 0,
        trend: null,
      },
    };

    const recentProducts = (recentProductsRes.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      status: p.status,
      category: p.categories?.name ?? null,
    }));

    return NextResponse.json({ success: true, data: { stats, recentProducts } });
  } catch (err) {
    console.error('[GET /api/v1/admin/stats]', err?.message ?? err);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
