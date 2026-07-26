import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminUser } from '@/middlewares/authGuard';
import { logger } from '@/lib/logger';

/**
 * GET /api/v1/admin/customers/[id]
 * Returns everything needed for the customer detail drawer:
 *   • the user profile (including ban flags)
 *   • every order they've placed with the line items and product names
 *   • the devices they've signed in from
 *   • a boolean for whether any of those devices is currently banned
 *
 * PATCH /api/v1/admin/customers/[id]
 * Body: { is_banned: boolean, reason?: string, include_devices?: boolean }
 *   • Bans / unbans the user.
 *   • When banning with `include_devices: true`, adds every known device_id
 *     for the user to `banned_devices`. When unbanning, removes them.
 */

export async function GET(_req, { params }) {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const service = createServiceClient();

    const [profileRes, ordersRes, devicesRes] = await Promise.all([
      service
        .from('users')
        .select(
          'id, full_name, email, phone_number, address, city, country, role, created_at, is_banned, banned_at, banned_reason'
        )
        .eq('id', id)
        .maybeSingle(),
      service
        .from('orders')
        .select(
          `
          id,
          order_number,
          status,
          total_amount,
          currency_code,
          created_at,
          shipping_address,
          order_items (
            quantity,
            unit_price,
            selected_color,
            selected_size,
            products ( id, name, product_images ( url, is_main ) )
          )
        `
        )
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
      service
        .from('user_devices')
        .select('device_id, user_agent, ip_address, first_seen, last_seen')
        .eq('user_id', id)
        .order('last_seen', { ascending: false }),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (!profileRes.data) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }
    if (ordersRes.error) throw ordersRes.error;
    if (devicesRes.error) throw devicesRes.error;

    const devices = devicesRes.data ?? [];

    // Which of the user's devices are currently in the ban list?
    let bannedDeviceIds = new Set();
    if (devices.length) {
      const { data: banned } = await service
        .from('banned_devices')
        .select('device_id')
        .in('device_id', devices.map((d) => d.device_id));
      bannedDeviceIds = new Set((banned ?? []).map((b) => b.device_id));
    }

    // Aggregate stats for the drawer header.
    const orders = ordersRes.data ?? [];
    const nonCancelled = orders.filter((o) => o.status !== 'cancelled');
    const totalSpent = nonCancelled.reduce(
      (s, o) => s + Number(o.total_amount ?? 0),
      0
    );
    const lastOrderAt = nonCancelled[0]?.created_at ?? null;

    return NextResponse.json({
      success: true,
      data: {
        profile: profileRes.data,
        orders: orders.map((o) => ({
          ...o,
          order_items: (o.order_items ?? []).map((it) => {
            const product = Array.isArray(it.products) ? it.products[0] : it.products;
            const images = product?.product_images ?? [];
            const mainImage =
              images.find((i) => i.is_main)?.url ?? images[0]?.url ?? null;
            return {
              quantity: it.quantity,
              unit_price: it.unit_price,
              selected_color: it.selected_color,
              selected_size: it.selected_size,
              product_id: product?.id ?? null,
              product_name: product?.name ?? '—',
              product_image: mainImage,
            };
          }),
        })),
        devices: devices.map((d) => ({
          ...d,
          is_banned: bannedDeviceIds.has(d.device_id),
        })),
        stats: {
          orders: nonCancelled.length,
          spent: Number(totalSpent.toFixed(2)),
          last_order_at: lastOrderAt,
        },
      },
    });
  } catch (err) {
    logger.error('GET /api/v1/admin/customers/[id]', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer' },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const isBanned = Boolean(body.is_banned);
    const includeDevices = Boolean(body.include_devices);
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;

    const service = createServiceClient();

    // Safety: never allow an admin to ban another admin (avoids lockouts).
    const { data: target } = await service
      .from('users')
      .select('id, role')
      .eq('id', id)
      .maybeSingle();

    if (!target) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }
    if (target.role === 'admin' && isBanned) {
      return NextResponse.json(
        { success: false, error: 'Cannot ban an admin account' },
        { status: 400 }
      );
    }

    const updates = {
      is_banned: isBanned,
      banned_at: isBanned ? new Date().toISOString() : null,
      banned_reason: isBanned ? reason : null,
      banned_by: isBanned ? adminUser.id : null,
    };

    const { error: updateError } = await service
      .from('users')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;

    if (isBanned && includeDevices) {
      // Copy every known device for this user into banned_devices.
      const { data: devices } = await service
        .from('user_devices')
        .select('device_id')
        .eq('user_id', id);

      const rows = (devices ?? []).map((d) => ({
        device_id: d.device_id,
        user_id: id,
        reason,
        banned_by: adminUser.id,
      }));

      if (rows.length) {
        await service
          .from('banned_devices')
          .upsert(rows, { onConflict: 'device_id' });
      }
    }

    if (!isBanned) {
      // Unbanning: clear this user's devices from the ban list too so they
      // can log back in from the same browser.
      const { data: devices } = await service
        .from('user_devices')
        .select('device_id')
        .eq('user_id', id);

      const ids = (devices ?? []).map((d) => d.device_id);
      if (ids.length) {
        await service.from('banned_devices').delete().in('device_id', ids);
      }
      // Also clear anything banned under the user_id column (in case the
      // devices row was removed).
      await service.from('banned_devices').delete().eq('user_id', id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('PATCH /api/v1/admin/customers/[id]', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}
