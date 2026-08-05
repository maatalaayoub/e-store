import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminUser } from '@/middlewares/authGuard';
import { logger } from '@/lib/logger';
import { buildCustomerClusters, findClusterById } from '@/lib/customer-dedupe';

/**
 * GET /api/v1/admin/customers/[id]
 *
 * `id` may be either:
 *   • a `users.id` UUID — for a registered account, or
 *   • the string "guest:<order-uuid>" — a cluster of guest orders.
 *
 * The endpoint returns the *entire deduplicated customer* — merging every
 * order (registered + guest) placed by the same physical person, plus every
 * device they've ever used. Ban state, when present, is read from the
 * primary registered user in the cluster.
 *
 * PATCH /api/v1/admin/customers/[id]
 * Body: { is_banned: boolean, reason?: string, include_devices?: boolean }
 *   • For a user cluster: flips `users.is_banned` and optionally adds every
 *     known device to `banned_devices`.
 *   • For a guest cluster: bans every device in the cluster (there is no
 *     account row to flag). `include_devices` is implicit.
 */

async function fetchAllForDedupe(service) {
  const [usersRes, ordersRes, devicesRes] = await Promise.all([
    service
      .from('users')
      .select(
        'id, full_name, email, phone_number, address, city, country, role, created_at, is_banned, banned_at, banned_reason'
      )
      .or('role.is.null,role.neq.admin'),
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
        user_id,
        device_id,
        order_items (
          quantity,
          unit_price,
          selected_color,
          selected_size,
          products ( id, name, product_images ( url, is_main ) )
        )
      `
      )
      .order('created_at', { ascending: false }),
    service.from('user_devices').select('user_id, device_id, user_agent, ip_address, first_seen, last_seen'),
  ]);

  if (usersRes.error) throw usersRes.error;
  if (ordersRes.error) throw ordersRes.error;
  const devices = devicesRes.error ? [] : devicesRes.data ?? [];

  return {
    users: usersRes.data ?? [],
    orders: ordersRes.data ?? [],
    devices,
  };
}

function normalizeOrder(o) {
  const items = (o.order_items ?? []).map((it) => {
    const product = Array.isArray(it.products) ? it.products[0] : it.products;
    const images = product?.product_images ?? [];
    const mainImage = images.find((i) => i.is_main)?.url ?? images[0]?.url ?? null;
    return {
      quantity: it.quantity,
      unit_price: it.unit_price,
      selected_color: it.selected_color,
      selected_size: it.selected_size,
      product_id: product?.id ?? null,
      product_name: product?.name ?? '—',
      product_image: mainImage,
    };
  });
  return {
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    total_amount: o.total_amount,
    currency_code: o.currency_code,
    created_at: o.created_at,
    is_guest: !o.user_id,
    shipping_address: o.shipping_address ?? null,
    order_items: items,
  };
}

export async function GET(_req, { params }) {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase, 'customers');
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const service = createServiceClient();

    const { users, orders, devices } = await fetchAllForDedupe(service);
    const clusters = buildCustomerClusters({ users, orders, devices });
    const cluster = findClusterById(clusters, id);

    if (!cluster) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Pull the actual order rows (with items) for orders in this cluster.
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const clusterOrders = cluster.order_ids
      .map((oid) => orderMap.get(oid))
      .filter(Boolean)
      .map(normalizeOrder);

    // Devices: registered ones from user_devices (if any user is in the cluster),
    // plus any distinct device_ids captured on the guest orders themselves.
    const deviceMap = new Map(); // device_id → row
    for (const d of devices) {
      if (cluster.user_ids.includes(d.user_id) && d.device_id) {
        deviceMap.set(d.device_id, {
          device_id: d.device_id,
          user_agent: d.user_agent ?? null,
          ip_address: d.ip_address ?? null,
          first_seen: d.first_seen ?? null,
          last_seen: d.last_seen ?? null,
          source: 'user',
        });
      }
    }
    for (const o of clusterOrders) {
      const rawOrder = orderMap.get(o.id);
      if (!rawOrder?.device_id) continue;
      const existing = deviceMap.get(rawOrder.device_id);
      if (!existing) {
        deviceMap.set(rawOrder.device_id, {
          device_id: rawOrder.device_id,
          user_agent: null,
          ip_address: null,
          first_seen: rawOrder.created_at,
          last_seen: rawOrder.created_at,
          source: 'order',
        });
      } else if (new Date(rawOrder.created_at) > new Date(existing.last_seen ?? 0)) {
        existing.last_seen = rawOrder.created_at;
      }
    }

    const devicesArr = [...deviceMap.values()].sort(
      (a, b) => new Date(b.last_seen ?? 0) - new Date(a.last_seen ?? 0)
    );

    // Check which of the cluster's devices are currently banned.
    let bannedDeviceIds = new Set();
    if (devicesArr.length) {
      const { data: banned } = await service
        .from('banned_devices')
        .select('device_id')
        .in('device_id', devicesArr.map((d) => d.device_id));
      bannedDeviceIds = new Set((banned ?? []).map((b) => b.device_id));
    }

    // Build a `profile` shape that works for both kinds. For guest clusters,
    // synthesise fields from the most recent shipping address.
    const primaryUser = users.find((u) => cluster.user_ids.includes(u.id)) ?? null;
    const latestOrder = clusterOrders[0];
    const sa = latestOrder?.shipping_address ?? {};

    const profile = primaryUser
      ? {
          id: primaryUser.id,
          kind: 'user',
          full_name: cluster.name,
          email: primaryUser.email ?? '',
          phone_number: primaryUser.phone_number ?? sa.phone ?? '',
          address: primaryUser.address ?? sa.address ?? '',
          city: primaryUser.city ?? sa.city ?? '',
          country: primaryUser.country ?? sa.country ?? '',
          role: primaryUser.role ?? 'client',
          created_at: primaryUser.created_at,
          is_banned: Boolean(primaryUser.is_banned),
          banned_at: primaryUser.banned_at ?? null,
          banned_reason: primaryUser.banned_reason ?? null,
        }
      : {
          id: cluster.id,
          kind: 'guest',
          full_name: cluster.name,
          email: sa.email ?? '',
          phone_number: sa.phone ?? '',
          address: sa.address ?? '',
          city: sa.city ?? '',
          country: sa.country ?? '',
          role: 'guest',
          created_at: cluster.joined_at,
          is_banned: devicesArr.length > 0 && devicesArr.every((d) => bannedDeviceIds.has(d.device_id)),
          banned_at: null,
          banned_reason: null,
        };

    const nonCancelled = clusterOrders.filter((o) => o.status !== 'cancelled');
    const totalSpent = nonCancelled.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        profile,
        orders: clusterOrders,
        devices: devicesArr.map((d) => ({
          ...d,
          is_banned: bannedDeviceIds.has(d.device_id),
        })),
        stats: {
          orders: nonCancelled.length,
          spent: Number(totalSpent.toFixed(2)),
          last_order_at: nonCancelled[0]?.created_at ?? null,
        },
        cluster: {
          signals: cluster.signals,
          user_ids: cluster.user_ids,
          order_ids: cluster.order_ids,
          guest_orders: cluster.guest_orders,
          registered_orders: clusterOrders.length - cluster.guest_orders,
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
    const adminUser = await getAdminUser(supabase, 'customers');
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const isBanned = Boolean(body.is_banned);
    const includeDevices = body.include_devices !== false; // default true
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;

    const service = createServiceClient();
    const { users, orders, devices } = await fetchAllForDedupe(service);
    const clusters = buildCustomerClusters({ users, orders, devices });
    const cluster = findClusterById(clusters, id);

    if (!cluster) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Safety: never allow banning an admin (avoids lockouts).
    const anyAdmin = users.some(
      (u) => cluster.user_ids.includes(u.id) && u.role === 'admin'
    );
    if (anyAdmin && isBanned) {
      return NextResponse.json(
        { success: false, error: 'Cannot ban an admin account' },
        { status: 400 }
      );
    }

    // Collect every device id we know about for this cluster.
    const clusterDeviceIds = new Set();
    for (const d of devices) {
      if (cluster.user_ids.includes(d.user_id) && d.device_id) clusterDeviceIds.add(d.device_id);
    }
    for (const o of orders) {
      if (cluster.order_ids.includes(o.id) && o.device_id) clusterDeviceIds.add(o.device_id);
    }

    // If we're banning a guest cluster with no devices, there's nothing to do.
    if (cluster.kind === 'guest' && isBanned && clusterDeviceIds.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'This guest customer has no known device to ban. They must place at least one order first.',
        },
        { status: 400 }
      );
    }

    // 1. Flip is_banned on every registered user in the cluster.
    if (cluster.user_ids.length > 0) {
      const updates = {
        is_banned: isBanned,
        banned_at: isBanned ? new Date().toISOString() : null,
        banned_reason: isBanned ? reason : null,
        banned_by: isBanned ? adminUser.id : null,
      };
      const { error: updateError } = await service
        .from('users')
        .update(updates)
        .in('id', cluster.user_ids);
      if (updateError) throw updateError;
    }

    // 2. Add / remove device bans.
    if (isBanned && (includeDevices || cluster.kind === 'guest') && clusterDeviceIds.size > 0) {
      const rows = [...clusterDeviceIds].map((deviceId) => ({
        device_id: deviceId,
        user_id: cluster.user_ids[0] ?? null,
        reason,
        banned_by: adminUser.id,
      }));
      await service.from('banned_devices').upsert(rows, { onConflict: 'device_id' });
    }

    if (!isBanned) {
      if (clusterDeviceIds.size > 0) {
        await service
          .from('banned_devices')
          .delete()
          .in('device_id', [...clusterDeviceIds]);
      }
      if (cluster.user_ids.length > 0) {
        await service
          .from('banned_devices')
          .delete()
          .in('user_id', cluster.user_ids);
      }
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
