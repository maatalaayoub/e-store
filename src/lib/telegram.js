import { createServiceClient } from '@/lib/supabase/service';

/**
 * In-memory cache for Telegram credentials.
 * Re-fetched at most every TELEGRAM_CONFIG_TTL_MS. Cleared by calling
 * {@link invalidateTelegramConfig} after an admin updates settings.
 */
const TELEGRAM_CONFIG_TTL_MS = 5 * 60 * 1000; // 5 minutes
let _configCache = null; // { value: { botToken, chatId }, ts: number }

export function invalidateTelegramConfig() {
  _configCache = null;
}

/**
 * Fetch Telegram credentials from store_settings.
 * Returns { botToken, chatId } — either or both may be empty strings.
 */
async function getTelegramConfig() {
  if (_configCache && Date.now() - _configCache.ts < TELEGRAM_CONFIG_TTL_MS) {
    return _configCache.value;
  }
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('store_settings')
    .select('key, value')
    .in('key', ['telegram_bot_token', 'telegram_chat_id']);

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? '']));
  const value = { botToken: map.telegram_bot_token ?? '', chatId: map.telegram_chat_id ?? '' };
  _configCache = { value, ts: Date.now() };
  return value;
}

// Telegram's sendMessage tops out at 4096 chars. Truncate defensively so
// oversized orders don't silently fail to notify the operator.
const TELEGRAM_MAX_LEN = 4000;

const TELEGRAM_TYPE_KEYS = {
  new_order: 'telegram_notify_new_order',
  order_cancelled: 'telegram_notify_order_cancelled',
  low_stock: 'telegram_notify_low_stock',
  out_of_stock: 'telegram_notify_out_of_stock',
};

async function getSetting(key, defaultValue = '') {
  try {
    const db = createServiceClient();
    const { data } = await db.from('store_settings').select('value').eq('key', key).single();
    return data?.value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

async function isTelegramEnabledForType(type) {
  const globalEnabled = (await getSetting('telegram_notifications_enabled', 'false')) === 'true';
  if (!globalEnabled) return false;
  const key = TELEGRAM_TYPE_KEYS[type];
  if (!key) return false;
  const typeEnabled = await getSetting(key, 'true');
  return typeEnabled !== 'false';
}

/**
 * Send a plain-text message to a Telegram chat via Bot API.
 * Fire-and-forget — errors are logged but never thrown.
 *
 * @param {string} text  HTML-safe message text
 * @param {string} [type]  Optional notification type. When provided, the
 *   message is only sent if Telegram notifications are globally enabled AND
 *   the per-type toggle for that event is on.
 */
export async function sendTelegramMessage(text, type) {
  try {
    if (type && !(await isTelegramEnabledForType(type))) return;

    const { botToken, chatId } = await getTelegramConfig();
    if (!botToken || !chatId) return; // not configured — skip silently

    const safe = String(text ?? '');
    const payload = safe.length > TELEGRAM_MAX_LEN
      ? safe.slice(0, TELEGRAM_MAX_LEN - 20) + '\n… [truncated]'
      : safe;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: payload, parse_mode: 'HTML' }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.warn('[Telegram] Failed to send message:', body);
    }
  } catch (err) {
    console.warn('[Telegram] Error sending message:', err?.message ?? err);
  }
}

/**
 * Escape characters reserved by Telegram's HTML parse mode so user input
 * cannot break formatting or inject markup. Telegram only requires
 * `< > &` to be escaped in text nodes (and `"` inside attribute values),
 * but we escape `"` defensively too.
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build an order notification message for Telegram.
 * All user-controlled fields are HTML-escaped before being embedded.
 */
export function buildOrderMessage({ id, customerName, phone, address, city, country, items, total, currency }) {
  const e = escapeHtml;
  const itemLines = [];
  for (const item of items) {
    itemLines.push(`  • ${e(item.name)} × ${e(item.qty)}  (${e(item.price)})`);
    const variantParts = [];
    if (item.color) variantParts.push(`Color: ${e(item.color)}`);
    if (item.size)  variantParts.push(`Size: ${e(item.size)}`);
    if (variantParts.length) itemLines.push(`     ↳ ${variantParts.join(' • ')}`);
  }

  const lines = [
    `🛒 <b>New Order #${e(id)}</b>`,
    ``,
    `👤 <b>${e(customerName)}</b>`,
    phone ? `📞 ${e(phone)}` : null,
    `📍 ${[address, city, country].filter(Boolean).map(e).join(', ')}`,
    ``,
    `<b>Items:</b>`,
    ...itemLines,
    ``,
    `💰 <b>Total: ${e(total)} ${e(currency)}</b>`,
  ];

  return lines.filter((l) => l !== null).join('\n');
}

/**
 * Build an order-cancellation notification message for Telegram.
 */
export function buildOrderCancelledMessage({ id, customerName, cancelledBy, total, currency }) {
  const e = escapeHtml;
  const actor = cancelledBy === 'admin' ? 'Admin' : 'Customer';
  return [
    `❌ <b>Order Cancelled #${e(id)}</b>`,
    ``,
    `👤 <b>${e(customerName)}</b>`,
    `📝 Cancelled by: ${e(actor)}`,
    ``,
    `💰 <b>Order total: ${e(total)} ${e(currency)}</b>`,
  ].join('\n');
}

/**
 * Build a low-stock notification message for Telegram.
 */
export function buildLowStockMessage({ productId, productName, stock, threshold }) {
  const e = escapeHtml;
  return [
    `⚠️ <b>Low Stock Alert</b>`,
    ``,
    `📦 ${e(productName)}`,
    `🔢 Stock: ${e(stock)} (threshold: ${e(threshold)})`,
  ].join('\n');
}

/**
 * Build an out-of-stock notification message for Telegram.
 */
export function buildOutOfStockMessage({ productId, productName }) {
  const e = escapeHtml;
  return [
    `🚫 <b>Out of Stock</b>`,
    ``,
    `📦 ${e(productName)}`,
    `🔢 Stock: 0`,
  ].join('\n');
}
