import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  sendTelegramMessage,
  buildOrderMessage,
  buildOrderCancelledMessage,
  buildLowStockMessage,
  buildOutOfStockMessage,
} from '@/lib/telegram';
import { getAdminUser, getStaffDataWindow, applyStaffDateWindow } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';
import { computeEffectivePrice } from '@/lib/price';
import { computePromoDiscount } from '@/lib/promo';
import { hasVariants, findVariantCombo } from '@/lib/product-variants';
import { logger } from '@/lib/logger';
import { getRequestDeviceId } from '@/lib/device-id';
import {
  createNewOrderNotification,
  createOrderCancelledNotification,
} from '@/modules/notifications/notification.service';
import { notifyOrderWhatsApp, statusToEvent } from '@/lib/whatsapp-order';

const IS_DEV = process.env.NODE_ENV !== 'production';
const PRICE_TOLERANCE = 0.01; // MAD
const MIN_EXCHANGE_RATE = 0.0001;
const MAX_EXCHANGE_RATE = 10000;

// Very small in-memory idempotency cache. Best-effort only — useful in long-lived
// node processes and within a single warm serverless instance. Survives ~5 minutes.
const idempotencyStore = new Map(); // key -> { ts, response }
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
function rememberIdempotent(key, payload) {
  idempotencyStore.set(key, { ts: Date.now(), payload });
  // opportunistic cleanup
  if (idempotencyStore.size > 500) {
    const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
    for (const [k, v] of idempotencyStore) if (v.ts < cutoff) idempotencyStore.delete(k);
  }
}
function recallIdempotent(key) {
  const hit = idempotencyStore.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > IDEMPOTENCY_TTL_MS) { idempotencyStore.delete(key); return null; }
  return hit.payload;
}

function isMissingVariantColumnError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  const details = String(error?.details ?? '').toLowerCase();
  const hint = String(error?.hint ?? '').toLowerCase();
  const text = `${message} ${details} ${hint}`;
  return (
    (error?.code === '42703' || error?.code === 'PGRST204') &&
    (
      text.includes('selected_color') ||
      text.includes('selected_size')
    )
  );
}

function isMissingDeviceIdColumnError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  const details = String(error?.details ?? '').toLowerCase();
  const hint = String(error?.hint ?? '').toLowerCase();
  const text = `${message} ${details} ${hint}`;
  return (
    (error?.code === '42703' || error?.code === 'PGRST204') &&
    text.includes('device_id')
  );
}

function effectivePriceMad(product) {
  // Centralised in src/lib/price.js \u2014 keeps server-side trusted pricing
  // and client-side display in lockstep.
  return computeEffectivePrice(product);
}

function safeExchangeRate(input) {
  const n = Number(input);
  if (!Number.isFinite(n) || n < MIN_EXCHANGE_RATE || n > MAX_EXCHANGE_RATE) return 1;
  return n;
}

function validateShipping(shipping) {
  const required = ['full_name', 'phone', 'address', 'city', 'country'];
  for (const key of required) {
    const value = shipping?.[key];
    if (typeof value !== 'string' || !value.trim()) {
      return `Missing required shipping field: ${key}`;
    }
  }
  const phone = String(shipping.phone).trim();
  // Very loose international phone sanity check: at least 7 digits anywhere.
  if (!/\d{7,}/.test(phone.replace(/\D/g, ''))) {
    return 'Invalid phone number';
  }
  // Reject obvious script / HTML injection in free-text fields.
  for (const key of required) {
    if (/[<>\"'&]/.test(shipping[key])) {
      return `Invalid characters in ${key}`;
    }
  }
  return null;
}

/**
 * POST /api/v1/orders
 * Create a new order (available to anyone — supports guest checkout).
 *
 * Body: { shipping, items: [{id, quantity, selected_color?, selected_size?}],
 *         currency_code?, exchange_rate? }
 *
 * SECURITY: Prices, totals, and stock are all computed/validated server-side
 * from the canonical `products` table. The `unit_price_mad` / `total_mad`
 * fields the client may send are IGNORED — kept only for backward compat.
 */
export async function POST(req) {
  // CSRF defence: reject if Origin/Referer is foreign in production.
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  // Rate limit — 5 orders per minute per IP is generous for a human checkout.
  const limited = await rateLimitOrReject(req, {
    bucket: 'orders-post',
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;
  try {
    const body = await req.json();
    const { shipping, items, currency_code, exchange_rate, promo_code_id } = body;

    if (
      !shipping ||
      typeof shipping !== 'object' ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: shipping, items' },
        { status: 400 }
      );
    }

    // Hard cap on cart size to bound resource usage / batch size.
    if (items.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Too many items in a single order' },
        { status: 400 }
      );
    }

    // Guest checkout hardening: validate shipping fields before any DB work.
    const shippingError = validateShipping(shipping);
    if (shippingError) {
      return NextResponse.json(
        { success: false, error: shippingError },
        { status: 400 }
      );
    }

    // Reject invalid promo code id shape early.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (promo_code_id != null && !UUID_RE.test(String(promo_code_id))) {
      return NextResponse.json({ success: false, error: 'invalid_promo_code' }, { status: 400 });
    }

    // Normalize items: keep only id + qty + variants. Reject malformed entries.
    const normalizedItems = [];
    for (const raw of items) {
      const id = String(raw?.id ?? '').trim();
      const quantity = Math.floor(Number(raw?.quantity));
      if (!id || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000) {
        return NextResponse.json(
          { success: false, error: 'Invalid cart item' },
          { status: 400 }
        );
      }
      normalizedItems.push({
        id,
        quantity,
        selected_color: raw?.selected_color ?? null,
        selected_size: raw?.selected_size ?? null,
        selected_variant: raw?.selected_variant ?? null,
      });
    }

    // Idempotency: caller may send a header to deduplicate retries.
    const idempotencyKey = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const cached = recallIdempotent(idempotencyKey);
      if (cached) return NextResponse.json(cached, { status: 201 });
    }

    // Try to get current user id (null for guests).
    let userId = null;
    try {
      const sessionClient = await createClient();
      const { data: { user } } = await sessionClient.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }

    // Storefront device cookie — recorded on every order so the admin can
    // re-identify repeat guest customers and, if needed, ban a device.
    let deviceId = null;
    try {
      deviceId = await getRequestDeviceId();
    } catch {
      deviceId = null;
    }

    // Service client — bypasses RLS so guests can create orders, and so the
    // stock-decrement / restore compensating writes work in a guest context.
    const db = createServiceClient();

    // Refuse the order if the signed-in user has been suspended by an admin.
    // (Admins are never banned, so no exemption needed here.)
    if (userId) {
      const { data: profile } = await db
        .from('users')
        .select('is_banned, role')
        .eq('id', userId)
        .maybeSingle();
      if (profile?.role !== 'admin' && profile?.is_banned) {
        return NextResponse.json(
          { success: false, error: 'Your account has been suspended.' },
          { status: 403 }
        );
      }
    }

    // Refuse the order if this device is banned. Registered users have already
    // been checked by requireAuth on other routes; this covers guest checkouts.
    if (deviceId) {
      const { data: bannedRow } = await db
        .from('banned_devices')
        .select('device_id')
        .eq('device_id', deviceId)
        .maybeSingle();
      if (bannedRow) {
        return NextResponse.json(
          { success: false, error: 'This device has been blocked from placing orders.' },
          { status: 403 }
        );
      }
    }

    // ── 1. Fetch canonical product rows for pricing + stock validation ────
    const productIds = normalizedItems.map((i) => i.id);
    const { data: productRows, error: productErr } = await db
      .from('products')
      .select('id, name, price, discount_price, discount_percentage, stock, status, category_id, variants')
      .in('id', productIds);

    if (productErr) throw productErr;

    const productMap = new Map((productRows ?? []).map((p) => [p.id, p]));
    const missing = productIds.filter((id) => !productMap.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'One or more items are no longer available' },
        { status: 409 }
      );
    }

    // ── 2. Server-side validation: status, stock, prices ──────────────────
    let serverTotalMad = 0;
    for (const item of normalizedItems) {
      const product = productMap.get(item.id);
      if (product.status !== 'active') {
        return NextResponse.json(
          { success: false, error: `Item unavailable: ${product.name}` },
          { status: 409 }
        );
      }
      if (Number(product.stock ?? 0) < item.quantity) {
        return NextResponse.json(
          { success: false, error: `Insufficient stock for: ${product.name}`, productId: product.id, available: product.stock },
          { status: 409 }
        );
      }
      // Configuration variants (RAM/Storage): reprice from the canonical combo
      // and validate its availability + stock. Client-sent surcharge is ignored.
      let variantSurcharge = 0;
      if (hasVariants(product.variants) && item.selected_variant) {
        const combo = findVariantCombo(product.variants, {
          ram: item.selected_variant.ram ?? null,
          storage: item.selected_variant.storage ?? null,
        });
        if (!combo || combo.available === false) {
          return NextResponse.json(
            { success: false, error: `Selected configuration unavailable for: ${product.name}` },
            { status: 409 }
          );
        }
        if (Number(combo.stock ?? 0) < item.quantity) {
          return NextResponse.json(
            { success: false, error: `Insufficient stock for: ${product.name}`, productId: product.id, available: combo.stock },
            { status: 409 }
          );
        }
        variantSurcharge = Number(combo.additional_price ?? 0);
        // Persist the server-validated variant label on the line's size field
        // so it shows in admin/order views without a schema change.
        item.selected_size = [item.selected_variant.ram, item.selected_variant.storage].filter(Boolean).join(' / ') || item.selected_size;
      }
      item.unit_price_mad = Math.round((effectivePriceMad(product) + variantSurcharge) * 100) / 100;
      item.name = product.name;
      item.category_id = product.category_id;
      serverTotalMad += item.unit_price_mad * item.quantity;
    }
    serverTotalMad = Math.round(serverTotalMad * 100) / 100;

    // ── 2b. Validate and apply promo code ────────────────────────────────
    let promoDiscount = 0;
    let appliedPromoId = null;
    let promoUsedCount = 0;
    if (promo_code_id) {
      const { data: promo, error: promoErr } = await db
        .from('promo_codes')
        .select('*')
        .eq('id', promo_code_id)
        .single();
      if (promoErr || !promo) {
        return NextResponse.json({ success: false, error: 'invalid_promo_code' }, { status: 400 });
      }
      const now = new Date();
      if (!promo.is_active ||
          (promo.starts_at && new Date(promo.starts_at) > now) ||
          (promo.expires_at && new Date(promo.expires_at) < now) ||
          (promo.usage_limit != null && promo.used_count >= promo.usage_limit)) {
        return NextResponse.json({ success: false, error: 'promo_code_unavailable' }, { status: 400 });
      }
      if (serverTotalMad < Number(promo.min_order_amount ?? 0)) {
        return NextResponse.json({ success: false, error: 'min_order_not_met' }, { status: 400 });
      }
      if (promo.max_order_amount != null && serverTotalMad > Number(promo.max_order_amount)) {
        return NextResponse.json({ success: false, error: 'max_order_exceeded' }, { status: 400 });
      }

      let applicableTotal = serverTotalMad;
      const promoProductIds = new Set((promo.product_ids ?? []).map(String));
      const promoCategoryIds = new Set((promo.category_ids ?? []).map(String));
      if (promo.applies_to === 'products') {
        applicableTotal = normalizedItems
          .filter((i) => promoProductIds.has(String(i.id)))
          .reduce((acc, i) => acc + i.unit_price_mad * i.quantity, 0);
      } else if (promo.applies_to === 'categories') {
        applicableTotal = normalizedItems
          .filter((i) => promoCategoryIds.has(String(i.category_id)))
          .reduce((acc, i) => acc + i.unit_price_mad * i.quantity, 0);
      }

      // Scoped promo but no cart item qualifies → refuse the order so the
      // customer isn't silently charged full price with a "promo" attached.
      if (promo.applies_to !== 'all' && applicableTotal <= 0) {
        return NextResponse.json({ success: false, error: 'promo_not_applicable' }, { status: 400 });
      }

      promoDiscount = computePromoDiscount(promo, applicableTotal);
      appliedPromoId = promo.id;
      promoUsedCount = promo.used_count ?? 0;
    }

    const finalTotalMad = Math.round((serverTotalMad - promoDiscount) * 100) / 100;
    if (finalTotalMad < 0) {
      return NextResponse.json({ success: false, error: 'invalid_order_total' }, { status: 400 });
    }

    // Sanitize currency hints (display only; canonical accounting stays in MAD).
    // Lowercase codes are normalized to uppercase; invalid codes fall back to MAD.
    const rawCurrency = typeof currency_code === 'string' ? currency_code.trim().toUpperCase() : '';
    const safeCurrency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : 'MAD';
    const safeRate = safeExchangeRate(exchange_rate);

    // ── 3. Insert the order + items. ─────────────────────────────────────
    // Stock is NOT decremented here. It is decremented only when the admin
    // confirms the order (PATCH → confirmed) and restored if cancelled before
    // shipping (PATCH → cancelled from confirmed/processing).
    const randomOrderNumber = () => Math.floor(10000000 + Math.random() * 90000000);

    let order, orderErr;
    for (let attempt = 0; attempt < 5; attempt++) {
      const insertPayload = {
        user_id: userId,
        status: 'pending',
        total_amount: finalTotalMad,     // canonical, server-computed after discount
        currency_code: safeCurrency,
        exchange_rate: safeRate,
        shipping_address: shipping,
        order_number: randomOrderNumber(),
        device_id: deviceId,
        promo_code_id: appliedPromoId,
        promo_discount_amount: promoDiscount,
      };

      let result = await db
        .from('orders')
        .insert(insertPayload)
        .select('id, order_number, total_amount, currency_code')
        .single();

      // Migration for `orders.device_id` may not have run yet — retry without.
      if (result.error && isMissingDeviceIdColumnError(result.error)) {
        if (IS_DEV) {
          console.warn('[POST /api/v1/orders] device_id column missing — migration pending');
        }
        const { device_id, ...fallback } = insertPayload;
        result = await db
          .from('orders')
          .insert(fallback)
          .select('id, order_number, total_amount, currency_code')
          .single();
      }

      if (!result.error || result.error.code !== '23505') {
        order = result.data;
        orderErr = result.error;
        break;
      }
    }

    if (orderErr) {
      throw orderErr;
    }

    const orderItems = normalizedItems.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.unit_price_mad,
      selected_color: item.selected_color,
      selected_size: item.selected_size,
    }));

    let { error: itemsErr } = await db.from('order_items').insert(orderItems);
    if (itemsErr) {
      if (isMissingVariantColumnError(itemsErr)) {
        const fallback = orderItems.map(({ selected_color, selected_size, ...rest }) => rest);
        const retry = await db.from('order_items').insert(fallback);
        itemsErr = retry.error;
        if (IS_DEV && !itemsErr) {
          console.warn('[POST /api/v1/orders] variant columns missing — migration pending');
        }
      }
      if (itemsErr) {
        await db.from('orders').delete().eq('id', order.id);
        throw itemsErr;
      }
    }

    // ── 4. Increment promo code usage counter (best-effort) ──────────────
    if (appliedPromoId) {
      try {
        await db
          .from('promo_codes')
          .update({ used_count: promoUsedCount + 1 })
          .eq('id', appliedPromoId);
      } catch (err) {
        logger.logSwallowed('POST /api/v1/orders: promo usage increment', err);
      }
    }

    // ── 5. Telegram (best-effort, never fails the order) ──────────────────
    try {
      const message = buildOrderMessage({
        id: String(order.order_number),
        customerName: shipping.full_name || 'Guest',
        phone: shipping.phone ?? '',
        address: shipping.address ?? '',
        city: shipping.city ?? '',
        country: shipping.country ?? '',
        items: normalizedItems.map((item) => ({
          name: item.name,
          qty: item.quantity,
          price: `${item.unit_price_mad} MAD`,
          color: item.selected_color?.name ?? null,
          size:  item.selected_size ?? null,
        })),
        total: finalTotalMad,
        currency: 'MAD',
        discount: promoDiscount > 0 ? `${promoDiscount} MAD` : undefined,
      });
      await sendTelegramMessage(message, 'new_order');
    } catch (err) {
      logger.logSwallowed('POST /api/v1/orders: telegram notification', err);
    }

    // ── 6. In-app admin notification (best-effort) ────────────────────────
    try {
      await createNewOrderNotification(order, shipping);
    } catch (err) {
      logger.logSwallowed('POST /api/v1/orders: in-app notification', err);
    }

    // ── 7. WhatsApp customer notification (best-effort) ───────────────────
    try {
      await notifyOrderWhatsApp({ event: 'created', order, shipping });
    } catch (err) {
      logger.logSwallowed('POST /api/v1/orders: whatsapp notification', err);
    }

    const responsePayload = { success: true, data: { id: order.id, order_number: order.order_number } };
    if (idempotencyKey) rememberIdempotent(idempotencyKey, responsePayload);
    return NextResponse.json(responsePayload, { status: 201 });
  } catch (err) {
    logger.error('POST /api/v1/orders', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

/**
 * Atomically decrement stock for a list of items.
 * Uses the decrement_product_stock RPC when available, falls back to a
 * conditional UPDATE (.gte race guard). Compensates already-decremented items
 * on failure. Returns null on success, or an error message string on failure.
 */
async function applyStockDecrement(db, items) {
  const decremented = [];
  for (const item of items) {
    const { data: updated, error: decErr } = await db.rpc('decrement_product_stock', {
      p_product_id: item.id,
      p_qty: item.quantity,
    });
    let ok;
    if (decErr && (decErr.code === '42883' || decErr.code === 'PGRST202')) {
      const { data: row } = await db.from('products').select('stock').eq('id', item.id).single();
      const { data: rows, error: upErr } = await db
        .from('products')
        .update({ stock: Number(row?.stock ?? 0) - item.quantity })
        .eq('id', item.id)
        .gte('stock', item.quantity)
        .select('id');
      if (upErr) { await restoreStock(db, decremented); throw upErr; }
      ok = (rows?.length ?? 0) > 0;
    } else if (decErr) {
      await restoreStock(db, decremented);
      throw decErr;
    } else {
      ok = updated === true || (Array.isArray(updated) && updated[0]?.ok === true) || updated === 1;
    }
    if (!ok) {
      await restoreStock(db, decremented);
      return `Insufficient stock for product: ${item.id}`;
    }
    decremented.push(item);
  }
  return null;
}

/**
 * Compensating action: restore stock for items we already decremented when a
 * later step in the order flow fails. Best-effort — logged but never thrown.
 */
async function restoreStock(db, decremented) {
  for (const d of decremented) {
    try {
      // Use raw SQL via RPC if available, otherwise read-modify-write. The
      // read-modify-write is safe enough as a recovery path because the
      // original conditional UPDATE already serialized the contended path.
      const { error } = await db.rpc('increment_product_stock', {
        p_product_id: d.id,
        p_qty: d.quantity,
      });
      if (error && (error.code === '42883' || error.code === 'PGRST202')) {
        const { data: row } = await db
          .from('products')
          .select('stock')
          .eq('id', d.id)
          .single();
        if (row) {
          await db
            .from('products')
            .update({ stock: Number(row.stock ?? 0) + d.quantity })
            .eq('id', d.id);
        }
      }
    } catch (e) {
      logger.logSwallowed(`restoreStock: product ${d.id}`, e);
    }
  }
}

/**
 * Best-effort Telegram alerts for products that hit low or out-of-stock
 * levels after an order is confirmed. Errors are swallowed so stock logic
 * is never affected by notification failures.
 */
async function sendStockTelegramAlerts(db, items) {
  try {
    const { data: thresholdRow } = await db
      .from('store_settings')
      .select('value')
      .eq('key', 'notify_low_stock_threshold')
      .single();
    const threshold = Math.max(1, parseInt(thresholdRow?.value ?? '5', 10) || 5);

    const productIds = items.map((i) => i.id).filter(Boolean);
    if (productIds.length === 0) return;

    const { data: products } = await db
      .from('products')
      .select('id, name, stock')
      .in('id', productIds);

    for (const product of products ?? []) {
      const stock = Number(product.stock ?? 0);
      if (stock === 0) {
        const msg = buildOutOfStockMessage({
          productId: product.id,
          productName: product.name,
        });
        await sendTelegramMessage(msg, 'out_of_stock');
      } else if (stock <= threshold) {
        const msg = buildLowStockMessage({
          productId: product.id,
          productName: product.name,
          stock,
          threshold,
        });
        await sendTelegramMessage(msg, 'low_stock');
      }
    }
  } catch (err) {
    logger.logSwallowed('sendStockTelegramAlerts', err);
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
    const adminUser = await getAdminUser(anonClient, 'orders');
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Staff may be limited to a date window on their store data.
    const dataWindow = await getStaffDataWindow(anonClient, adminUser.id);

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
      shipping_address,
      promo_code_id,
      promo_discount_amount,
      promo_codes ( code )
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
      promo_code_id,
      promo_discount_amount,
      promo_codes ( code ),
      order_items (
        quantity,
        unit_price,
        selected_color,
        selected_size,
        products (
          id,
          name,
          translations,
          categories ( id, name, translations ),
          product_images ( url, is_main, display_order )
        )
      )
    `;

    if (id) {
      let detailQuery = anonClient
        .from('orders')
        .select(detailFields)
        .eq('id', id);
      // Staff cannot open orders that predate their allowed window.
      detailQuery = applyStaffDateWindow(detailQuery, dataWindow);
      const { data, error } = await detailQuery.single();
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // ── Parse pagination / filter / sort params ─────────────────────────
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const statusParam = searchParams.get('status');
    const sortParam = searchParams.get('sort');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    // Optional created_at range (used by the calendar to fetch only the visible
    // window). Accepts any Date-parseable string; invalid values are ignored.
    const fromDate = fromParam ? new Date(fromParam) : null;
    const toDate = toParam ? new Date(toParam) : null;
    const fromIso = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate.toISOString() : null;
    const toIso = toDate && !Number.isNaN(toDate.getTime()) ? toDate.toISOString() : null;

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

    // Date-range scoping (indexed on created_at). Keeps calendar/date-filtered
    // requests from scanning the whole table.
    if (fromIso) query = query.gte('created_at', fromIso);
    if (toIso) query = query.lte('created_at', toIso);

    // Restrict staff to orders within their allowed date window.
    query = applyStaffDateWindow(query, dataWindow);

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
  // CSRF defence: reject if Origin/Referer is foreign in production.
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;

  // Rate limit — 10 status updates per minute per IP.
  const limited = await rateLimitOrReject(req, {
    bucket: 'orders-patch',
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

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
    const { data: userData } = await supabase.from('users').select('role, permissions').eq('id', user.id).single();
    const isAdmin =
      userData?.role === 'admin' ||
      (userData?.role === 'staff' &&
        Array.isArray(userData?.permissions) &&
        userData.permissions.includes('orders'));

    if (isAdmin) {
      const db = createServiceClient();

      // Fetch current order + items to manage stock on status transitions
      const { data: currentOrder, error: orderFetchErr } = await db
        .from('orders')
        .select('id, order_number, status, stock_committed, total_amount, currency_code, order_items(product_id, quantity), shipping_address')
        .eq('id', id)
        .single();
      if (orderFetchErr || !currentOrder) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }

      const prevStatus = currentOrder.status;
      const stockCommitted = currentOrder.stock_committed ?? false;
      const stockItems = (currentOrder.order_items ?? []).map(i => ({ id: i.product_id, quantity: i.quantity }));

      const update = { status };

      // Decrement stock when confirming (idempotent: skip if already committed)
      if (status === 'confirmed' && !stockCommitted) {
        const stockErr = await applyStockDecrement(db, stockItems);
        if (stockErr) {
          return NextResponse.json({ success: false, error: stockErr }, { status: 409 });
        }
        update.stock_committed = true;
        // Fire Telegram stock alerts after successful decrement.
        try {
          await sendStockTelegramAlerts(db, stockItems);
        } catch { /* notification errors must never surface */ }
      }

      // Restore stock when cancelling any order that had stock committed (before shipping)
      if (status === 'cancelled' && stockCommitted) {
        await restoreStock(db, stockItems);
        update.stock_committed = false;
      }

      if (status === 'cancelled') update.cancelled_by = 'admin';
      else update.cancelled_by = null;
      const { data: updated, error } = await supabase.from('orders').update(update).eq('id', id).select('id');
      if (error) throw error;
      if (!updated?.length) throw new Error('Update blocked — check RLS policies');

      // Notify admins when an order is cancelled.
      if (status === 'cancelled') {
        try {
          await createOrderCancelledNotification(currentOrder, 'admin');
        } catch (err) {
          logger.logSwallowed('PATCH /api/v1/orders: in-app cancel notification (admin)', err);
        }
        try {
          const msg = buildOrderCancelledMessage({
            id: String(currentOrder.order_number ?? currentOrder.id ?? ''),
            customerName: currentOrder.shipping_address?.full_name || 'Guest',
            cancelledBy: 'admin',
            total: Number(currentOrder.total_amount ?? 0),
            currency: 'MAD',
          });
          await sendTelegramMessage(msg, 'order_cancelled');
        } catch (err) {
          logger.logSwallowed('PATCH /api/v1/orders: telegram cancel notification (admin)', err);
        }
      }

      // WhatsApp customer notification for this status transition (best-effort).
      try {
        const event = statusToEvent(status);
        if (event) {
          await notifyOrderWhatsApp({ event, order: currentOrder, shipping: currentOrder.shipping_address });
        }
      } catch (err) {
        logger.logSwallowed('PATCH /api/v1/orders: whatsapp status notification (admin)', err);
      }

      return NextResponse.json({ success: true });
    }

    // Non-admin: can only cancel their own pending order
    if (status !== 'cancelled') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const db = createServiceClient();
    const { data: order, error: fetchErr } = await db
      .from('orders')
      .select('id, order_number, status, user_id, stock_committed, total_amount, currency_code, order_items(product_id, quantity), shipping_address')
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

    // Restore stock if it was committed for this order
    if (order.stock_committed) {
      const stockItems = (order.order_items ?? []).map(i => ({ id: i.product_id, quantity: i.quantity }));
      await restoreStock(db, stockItems);
    }

    const { data: updated, error } = await db
      .from('orders')
      .update({ status: 'cancelled', cancelled_by: 'customer', stock_committed: false })
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!updated?.length) throw new Error('Update blocked — check RLS policies on orders table');

    // Notify admins when a customer cancels an order.
    try {
      await createOrderCancelledNotification(order, 'customer');
    } catch (err) {
      logger.logSwallowed('PATCH /api/v1/orders: in-app cancel notification (customer)', err);
    }
    try {
      const msg = buildOrderCancelledMessage({
        id: String(order.order_number ?? order.id ?? ''),
        customerName: order.shipping_address?.full_name || 'Guest',
        cancelledBy: 'customer',
        total: Number(order.total_amount ?? 0),
        currency: 'MAD',
      });
      await sendTelegramMessage(msg, 'order_cancelled');
    } catch (err) {
      logger.logSwallowed('PATCH /api/v1/orders: telegram cancel notification (customer)', err);
    }

    // WhatsApp customer notification (best-effort).
    try {
      await notifyOrderWhatsApp({ event: 'cancelled', order, shipping: order.shipping_address });
    } catch (err) {
      logger.logSwallowed('PATCH /api/v1/orders: whatsapp cancel notification (customer)', err);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('PATCH /api/v1/orders', err);
    return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/orders
 * Admin-only bulk delete. Accepts either `?id=<uuid>` (single) or JSON body
 * `{ ids: [uuid, ...] }`. Restores stock for any deleted order that still has
 * `stock_committed = true`, then deletes the orders (line items cascade via FK).
 */
export async function DELETE(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;

  const limited = await rateLimitOrReject(req, {
    bucket: 'orders-delete',
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const anonClient = await createClient();
    const adminUser = await getAdminUser(anonClient, 'orders');
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Collect ids from query string or JSON body.
    const { searchParams } = new URL(req.url);
    const singleId = searchParams.get('id');
    let ids = [];
    if (singleId) {
      ids = [singleId];
    } else {
      try {
        const body = await req.json();
        if (Array.isArray(body?.ids)) ids = body.ids.filter(Boolean);
      } catch {
        // no body
      }
    }
    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Order id(s) required' },
        { status: 400 },
      );
    }

    const db = createServiceClient();

    // Enforce staff data window: staff can only delete orders within their
    // allowed date range.
    const dataWindow = await getStaffDataWindow(anonClient, adminUser.id);

    let selectQuery = db
      .from('orders')
      .select('id, stock_committed, order_items(product_id, quantity)')
      .in('id', ids);
    selectQuery = applyStaffDateWindow(selectQuery, dataWindow);
    const { data: rows, error: fetchErr } = await selectQuery;
    if (fetchErr) throw fetchErr;

    const allowedIds = (rows ?? []).map((r) => r.id);
    if (allowedIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No matching orders found' },
        { status: 404 },
      );
    }

    // Restore stock for any order that still had stock committed. This mirrors
    // the cancel-flow behaviour so deletion never leaves ghost decrements.
    for (const row of rows ?? []) {
      if (!row.stock_committed) continue;
      const items = (row.order_items ?? []).map((i) => ({
        id: i.product_id,
        quantity: i.quantity,
      }));
      if (items.length > 0) {
        await restoreStock(db, items);
      }
    }

    const { error: delErr } = await db
      .from('orders')
      .delete()
      .in('id', allowedIds);
    if (delErr) throw delErr;

    return NextResponse.json({ success: true, deleted: allowedIds.length });
  } catch (err) {
    logger.error('DELETE /api/v1/orders', err);
    return NextResponse.json(
      { success: false, error: 'Failed to delete order(s)' },
      { status: 500 },
    );
  }
}
