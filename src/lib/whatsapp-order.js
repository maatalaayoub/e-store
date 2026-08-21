import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/logger';
import { env } from '@/config/env';
import { sendWhatsAppTemplate, buildTemplateBody } from '@/lib/whatsapp';

/**
 * Order-event → WhatsApp orchestration. Bridges the existing order-status
 * system to the reusable WhatsApp service. Each event maps to a pre-approved
 * Meta template (see Phase 7). Fire-and-forget: never throws, never blocks the
 * order flow, and de-duplicates sends via `whatsapp_message_log`.
 */

/** Customer-facing order events and their per-event toggle + template name. */
export const ORDER_EVENT_CONFIG = {
  created:   { setting: 'whatsapp_notify_created',   template: 'order_created' },
  confirmed: { setting: 'whatsapp_notify_confirmed', template: 'order_confirmed' },
  processing:{ setting: 'whatsapp_notify_processing',template: 'order_processing' },
  shipped:   { setting: 'whatsapp_notify_shipped',   template: 'order_shipped' },
  delivered: { setting: 'whatsapp_notify_delivered', template: 'order_delivered' },
  cancelled: { setting: 'whatsapp_notify_cancelled', template: 'order_cancelled' },
  invoice_ready: { setting: 'whatsapp_notify_invoice_ready', template: 'invoice_ready' },
};

/** Map an order status to its customer event (created is handled separately). */
export function statusToEvent(status) {
  return ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)
    ? status
    : null;
}

const LANG_MAP = { en: 'en_US', en_US: 'en_US', fr: 'fr', ar: 'ar', dr: 'ar' };

async function getSetting(key, defaultValue = '') {
  try {
    const db = createServiceClient();
    const { data } = await db.from('store_settings').select('value').eq('key', key).single();
    return data?.value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

async function isEnabledForEvent(event) {
  const globalEnabled = (await getSetting('whatsapp_notifications_enabled', 'false')) === 'true';
  if (!globalEnabled) return false;
  const key = ORDER_EVENT_CONFIG[event]?.setting;
  if (!key) return false;
  return (await getSetting(key, 'true')) !== 'false';
}

async function resolveTemplateLanguage() {
  const lang = await getSetting('localization_default_language', 'en');
  return LANG_MAP[lang] || 'en_US';
}

/** Keep only the last 4 digits when logging a recipient, for privacy. */
function maskPhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return `••••${digits.slice(-4)}`;
}

function isMissingTable(err) {
  if (!err) return false;
  if (err.code === '42P01' || err.code === 'PGRST205') return true;
  return /relation .* does not exist|could not find the table|schema cache/i.test(String(err.message ?? ''));
}

/**
 * Send the WhatsApp notification for a single order event. Best-effort.
 *
 * @param {object} args
 * @param {string} args.event   One of ORDER_EVENT_CONFIG keys.
 * @param {object} args.order   Order row: needs `id`, `order_number`.
 * @param {object} [args.shipping]  Shipping address; falls back to order.shipping_address.
 */
export async function notifyOrderWhatsApp({ event, order, shipping }) {
  try {
    if (!ORDER_EVENT_CONFIG[event]) return;
    if (!(await isEnabledForEvent(event))) return;

    const ship = shipping ?? order?.shipping_address ?? {};
    const rawPhone = ship?.phone ?? '';
    if (!rawPhone) return; // customer has no phone — nothing to send

    const db = createServiceClient();
    const orderId = order?.id ?? null;

    // Atomically claim (order, event) to prevent duplicate sends. If the log
    // table isn't present yet, proceed best-effort without de-duplication.
    let claimed = false;
    if (orderId) {
      const claim = await db
        .from('whatsapp_message_log')
        .insert({ order_id: orderId, event, recipient: maskPhone(rawPhone), status: 'pending' })
        .select('id')
        .single();
      if (claim.error) {
        if (claim.error.code === '23505') return; // already sent for this event
        if (!isMissingTable(claim.error)) {
          logger.logSwallowed('notifyOrderWhatsApp: claim insert', claim.error);
        }
      } else {
        claimed = true;
      }
    }

    const defaultCountryCode = await getSetting('whatsapp_default_country_code', '');
    const languageCode = await resolveTemplateLanguage();
    const { template } = ORDER_EVENT_CONFIG[event];

    const components = buildTemplateBody([
      ship.full_name || 'Customer',
      String(order?.order_number ?? order?.id ?? ''),
    ]);

    const result = await sendWhatsAppTemplate(
      rawPhone,
      { name: template, languageCode, components },
      { defaultCountryCode },
    );

    if (claimed) {
      if (result.ok) {
        await db
          .from('whatsapp_message_log')
          .update({ status: 'sent', message_id: result.messageId ?? null, error: null })
          .eq('order_id', orderId)
          .eq('event', event);
      } else {
        // Free the claim so a later attempt can retry this event.
        await db.from('whatsapp_message_log').delete().eq('order_id', orderId).eq('event', event);
      }
    }
  } catch (err) {
    logger.logSwallowed('notifyOrderWhatsApp', err);
  }
}

/**
 * Send the invoice link to the customer over WhatsApp. Admin-triggered and
 * resendable: it delivers a secure, non-enumerable invoice URL
 * (`/{locale}/invoice/{uuid}`) where the customer can view and download the
 * PDF — no private file is ever exposed publicly. Best-effort; never throws.
 *
 * @param {object} args
 * @param {object} args.order  Order row: needs `id`, `order_number`, `shipping_address`.
 * @param {object} [args.shipping]  Overrides order.shipping_address.
 * @returns {Promise<{ok: boolean, error?: string, messageId?: string|null}>}
 */
export async function sendInvoiceWhatsApp({ order, shipping }) {
  try {
    if (!(await isEnabledForEvent('invoice_ready'))) return { ok: false, error: 'disabled' };

    const ship = shipping ?? order?.shipping_address ?? {};
    const rawPhone = ship?.phone ?? '';
    if (!rawPhone) return { ok: false, error: 'invalid_phone' };

    const defaultCountryCode = await getSetting('whatsapp_default_country_code', '');
    const languageCode = await resolveTemplateLanguage();
    const locale = await getSetting('localization_default_language', 'en');
    const siteUrl = (env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    const invoiceUrl = `${siteUrl}/${locale}/invoice/${order.id}`;

    const components = buildTemplateBody([
      ship.full_name || 'Customer',
      String(order?.order_number ?? order?.id ?? ''),
      invoiceUrl,
    ]);

    const result = await sendWhatsAppTemplate(
      rawPhone,
      { name: ORDER_EVENT_CONFIG.invoice_ready.template, languageCode, components },
      { defaultCountryCode },
    );

    // Audit log — upsert so the invoice can be resent (one row per order/event).
    try {
      const db = createServiceClient();
      await db.from('whatsapp_message_log').upsert(
        {
          order_id: order.id,
          event: 'invoice_ready',
          recipient: maskPhone(rawPhone),
          message_id: result.messageId ?? null,
          status: result.ok ? 'sent' : 'failed',
          error: result.ok ? null : String(result.error ?? ''),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'order_id,event' },
      );
    } catch { /* logging must never break the send */ }

    return result;
  } catch (err) {
    logger.logSwallowed('sendInvoiceWhatsApp', err);
    return { ok: false, error: 'unexpected_error' };
  }
}
