import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminUser } from '@/middlewares/authGuard';
import { logger } from '@/lib/logger';

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

    // Period boundaries (computed once so SQL filters are consistent).
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    // Each block below is a small server-side aggregate (count or sum)
    // instead of pulling every orders row into Node. For a store with
    // 100k+ orders this is the difference between ~200ms and OOM.
    const sumActiveRevenue = (b) => b.select('total_amount').neq('status', 'cancelled');

    const [
      totalOrdersCountRes,
      totalRevenueRes,
      thisMonthOrdersCountRes,
      lastMonthOrdersCountRes,
      thisMonthRevenueRes,
      lastMonthRevenueRes,
      productsRes,
      customersRes,
      recentProductsRes,
    ] = await Promise.all([
      // Total order count (head:true \u2014 no row payload).
      supabase.from('orders').select('id', { count: 'exact', head: true }),

      // Total non-cancelled revenue \u2014 stream only `total_amount`.
      sumActiveRevenue(supabase.from('orders')),

      // This-month order count.
      supabase.from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfThisMonth),

      // Last-month order count.
      supabase.from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfLastMonth)
        .lt('created_at', startOfThisMonth),

      // This-month non-cancelled revenue.
      sumActiveRevenue(supabase.from('orders'))
        .gte('created_at', startOfThisMonth),

      // Last-month non-cancelled revenue.
      sumActiveRevenue(supabase.from('orders'))
        .gte('created_at', startOfLastMonth)
        .lt('created_at', startOfThisMonth),

      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer'),
      supabase.from('products')
        .select(`
          id,
          name,
          price,
          status,
          stock,
          categories ( name ),
          product_images ( url, is_main, display_order )
        `)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    for (const r of [totalOrdersCountRes, totalRevenueRes, thisMonthOrdersCountRes,
      lastMonthOrdersCountRes, thisMonthRevenueRes, lastMonthRevenueRes,
      productsRes, customersRes, recentProductsRes]) {
      if (r.error) throw r.error;
    }

    const sumAmount = (rows) =>
      (rows ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

    const totalRevenue = sumAmount(totalRevenueRes.data);
    const thisMonthRevenue = sumAmount(thisMonthRevenueRes.data);
    const lastMonthRevenue = sumAmount(lastMonthRevenueRes.data);
    const totalOrdersCount = totalOrdersCountRes.count ?? 0;
    const thisMonthCount = thisMonthOrdersCountRes.count ?? 0;
    const lastMonthCount = lastMonthOrdersCountRes.count ?? 0;

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
        value: totalOrdersCount,
        trend: pct(thisMonthCount, lastMonthCount),
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

    const recentProducts = (recentProductsRes.data ?? []).map((p) => {
      const images = Array.isArray(p.product_images) ? p.product_images : [];
      const sortedImages = [...images].sort((a, b) => {
        if (a.is_main !== b.is_main) return a.is_main ? -1 : 1;
        return (a.display_order ?? 0) - (b.display_order ?? 0);
      });
      const mainImage = sortedImages[0]?.url ?? null;
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        status: p.status,
        category: p.categories?.name ?? null,
        image: mainImage,
      };
    });

    return NextResponse.json({ success: true, data: { stats, recentProducts } });
  } catch (err) {
    logger.error('GET /api/v1/admin/stats', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
