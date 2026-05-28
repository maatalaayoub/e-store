import { createServiceClient } from '@/lib/supabase/service';

/**
 * Fetch Telegram credentials from store_settings.
 * Returns { botToken, chatId } — either or both may be empty strings.
 */
async function getTelegramConfig() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('store_settings')
    .select('key, value')
    .in('key', ['telegram_bot_token', 'telegram_chat_id']);

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? '']));
  return { botToken: map.telegram_bot_token ?? '', chatId: map.telegram_chat_id ?? '' };
}

/**
 * Send a plain-text message to a Telegram chat via Bot API.
 * Fire-and-forget — errors are logged but never thrown.
 *
 * @param {string} text  Markdown-safe message text
 */
export async function sendTelegramMessage(text) {
  try {
    const { botToken, chatId } = await getTelegramConfig();
    if (!botToken || !chatId) return; // not configured — skip silently

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
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
