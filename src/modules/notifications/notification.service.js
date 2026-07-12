import { createServiceClient } from '@/lib/supabase/service';

export const NOTIFICATION_TYPES = {
  NEW_ORDER: 'new_order',
  ORDER_CANCELLED: 'order_cancelled',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
};

async function isNotificationEnabled(key, defaultValue = 'true') {
  try {
    const db = createServiceClient();
    const { data } = await db
      .from('store_settings')
      .select('value')
      .eq('key', key)
      .single();
    const value = data?.value;
    if (value == null || value === '') return defaultValue !== 'false';
    return value === 'true';
  } catch {
    return defaultValue !== 'false';
  }
}

export async function createNewOrderNotification(order, shipping) {
  const enabled = await isNotificationEnabled('notify_new_order', 'true');
  if (!enabled) return;

  const db = createServiceClient();
  await db.from('admin_notifications').insert({
    type: NOTIFICATION_TYPES.NEW_ORDER,
    payload: {
      order_id: order.id,
      order_number: String(order.order_number ?? ''),
      customer_name: shipping?.full_name || 'Guest',
      phone: shipping?.phone || '',
      // total_amount is canonical MAD (store base currency). Display in MAD
      // regardless of the customer's selected currency.
      total: Number(order.total_amount ?? 0),
      currency: 'MAD',
    },
  });
}

export async function createOrderCancelledNotification(order, cancelledBy = 'customer') {
  const enabled = await isNotificationEnabled('notify_order_cancelled', 'true');
  if (!enabled) return;

  const db = createServiceClient();
  await db.from('admin_notifications').insert({
    type: NOTIFICATION_TYPES.ORDER_CANCELLED,
    payload: {
      order_id: order.id,
      order_number: String(order.order_number ?? ''),
      customer_name: order.shipping_address?.full_name || 'Guest',
      cancelled_by: cancelledBy,
      // total_amount is canonical MAD (store base currency).
      total: Number(order.total_amount ?? 0),
      currency: 'MAD',
    },
  });
}

export async function createLowStockNotification(product, threshold = 5) {
  const enabled = await isNotificationEnabled('notify_low_stock', 'true');
  if (!enabled) return;

  const db = createServiceClient();
  await db.from('admin_notifications').insert({
    type: NOTIFICATION_TYPES.LOW_STOCK,
    payload: {
      product_id: product.id,
      product_name: product.name,
      stock: Number(product.stock ?? 0),
      threshold: Number(threshold),
    },
  });
}

export async function createOutOfStockNotification(product) {
  const enabled = await isNotificationEnabled('notify_out_of_stock', 'true');
  if (!enabled) return;

  const db = createServiceClient();
  await db.from('admin_notifications').insert({
    type: NOTIFICATION_TYPES.OUT_OF_STOCK,
    payload: {
      product_id: product.id,
      product_name: product.name,
      stock: 0,
    },
  });
}
