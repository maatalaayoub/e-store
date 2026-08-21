import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';
import { invalidateTelegramConfig } from '@/lib/telegram';
import { invalidateWhatsAppConfig, encryptWhatsAppToken } from '@/lib/whatsapp';
import { logger } from '@/lib/logger';
import { PUBLIC_KEYS } from '@/lib/display-settings';

const ALLOWED_KEYS = [
  'telegram_bot_token',
  'telegram_chat_id',
  'product_card_button_style',
  'product_card_filled_bg',
  'product_card_filled_text',
  'product_card_outline_border',
  'product_card_outline_text',
  'product_card_outline_icon',
  'product_card_outline_bg',
  'product_card_button_font_size',
  'product_card_layout',
  'product_card_show_short_description',
  'product_card_hide_buttons',
  'carousel_items_mobile',
  'carousel_items_tablet',
  'carousel_items_desktop',
  'carousel_products_per_row',
  'carousel_autoplay',
  'carousel_interval',
  'carousel_speed',
  // Hero section
  'hero_type',
  'hero_single_config',
  'hero_multi_config',
  'hero_video_config',
  'hero_countdown_config',
  'hero_iherb_config',
  // Contact section
  'contact_email',
  'contact_phone',
  'contact_whatsapp',
  'contact_address',
  'contact_lat',
  'contact_lng',
  // General / footer
  'store_name',
  'store_description',
  'store_logo',
  'store_logo_dark',
  'show_social_whatsapp',
  'show_social_instagram',
  'show_social_facebook',
  'show_social_tiktok',
  'social_whatsapp',
  'social_instagram',
  'social_facebook',
  'social_tiktok',
  // Admin notification settings
  'notify_new_order',
  'notify_order_cancelled',
  'notify_low_stock',
  'notify_out_of_stock',
  'notify_low_stock_threshold',
  // Telegram notification settings
  'telegram_notifications_enabled',
  'telegram_notify_new_order',
  'telegram_notify_order_cancelled',
  'telegram_notify_low_stock',
  'telegram_notify_out_of_stock',
  // WhatsApp Business Cloud API integration
  'whatsapp_access_token',
  'whatsapp_phone_number_id',
  'whatsapp_business_account_id',
  'whatsapp_notifications_enabled',
  'whatsapp_default_country_code',
  // WhatsApp per-event notification toggles
  'whatsapp_notify_created',
  'whatsapp_notify_confirmed',
  'whatsapp_notify_processing',
  'whatsapp_notify_shipped',
  'whatsapp_notify_delivered',
  'whatsapp_notify_cancelled',
  'whatsapp_notify_invoice_ready',
  'store_logo_size',
  'store_logo_height',
  // Storefront header + sidebar
  'header_cart_icon',
  'header_menu_icon',
  'sidebar_theme',
  // Mobile bottom navigation
  'mobile_nav_enabled',
  'mobile_nav_show_home',
  'mobile_nav_show_favorites',
  'mobile_nav_show_cart',
  'mobile_nav_show_account',
  'mobile_nav_show_orders',
  'mobile_nav_show_menu',
  // Payments
  'payments_currency',
  'payments_cod_enabled',
  // Order fulfillment methods
  'order_whatsapp_enabled',
  'order_whatsapp_number',
  'order_whatsapp_all_countries',
  'order_online_enabled',
  // Shipping
  'shipping_origin',
  'shipping_flat_rate',
  'shipping_free_threshold',
  // Localization
  'localization_default_language',
  'localization_timezone',
];

// Per-key value size limits. Hero configs can hold long JSON (image URLs etc.).
const VALUE_MAX = {
  hero_single_config:    8000,
  hero_multi_config:     4000,
  hero_video_config:     6000,
  hero_countdown_config: 5000,
  hero_iherb_config:     60000,
  whatsapp_access_token: 1000,
};
const DEFAULT_VALUE_MAX = 1000;

// Keys whose stored value is a secret: encrypted at rest, never returned to
// the client, and left untouched on PATCH when an empty value is submitted.
const SECRET_KEYS = new Set(['whatsapp_access_token']);

/**
 * GET /api/v1/settings
 * Returns all store settings as { key: value } — admin only.
 */
export async function GET() {
  try {
    await requireAdmin('settings');

    const supabase = createServiceClient();
    const { data, error } = await supabase.from('store_settings').select('key, value');
    if (error) {
      // Table may not exist yet — return empty settings instead of 500
      logger.warn('GET /api/v1/settings: DB error (table may not exist yet)', error);
      const empty = Object.fromEntries(ALLOWED_KEYS.map((k) => [k, '']));
      return NextResponse.json({ success: true, data: empty });
    }

    const settings = Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? '']));
    // Fill missing keys with empty string
    for (const key of ALLOWED_KEYS) {
      if (!(key in settings)) settings[key] = '';
    }
    // Never expose secret values. Report only whether each secret is configured.
    const secretsSet = {};
    for (const key of SECRET_KEYS) {
      secretsSet[key] = Boolean(settings[key]);
      settings[key] = '';
    }
    return NextResponse.json({ success: true, data: settings, secretsSet });
  } catch (err) {
    if (err?.statusCode === 401 || err?.message?.toLowerCase().includes('unauthorized') || err?.message?.toLowerCase().includes('logged in')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('GET /api/v1/settings', err);
    return NextResponse.json({ success: false, error: 'Failed to load settings' }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/settings
 * Upsert store settings — admin only.
 * Body: { telegram_bot_token?, telegram_chat_id?, whatsapp_number?, whatsapp_business_name? }
 */
export async function PATCH(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'admin-settings', limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  try {
    await requireAdmin('settings');

    const body = await req.json();
    const upserts = Object.entries(body)
      .filter(([k]) => ALLOWED_KEYS.includes(k))
      // For secrets, an empty value means "leave unchanged" — never overwrite
      // a stored credential with a blank on partial saves.
      .filter(([k, value]) => !(SECRET_KEYS.has(k) && String(value ?? '') === ''))
      .map(([key, value]) => {
        // Hard-bound the stored value so a typo / pasted blob can't bloat
        // the settings table. Config keys get a larger allowance for JSON.
        const bounded = String(value ?? '').slice(0, VALUE_MAX[key] ?? DEFAULT_VALUE_MAX);
        return {
          key,
          // Secrets are encrypted at rest before being written.
          value: SECRET_KEYS.has(key) ? encryptWhatsAppToken(bounded) : bounded,
          updated_at: new Date().toISOString(),
        };
      });

    if (upserts.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid keys provided' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('store_settings')
      .upsert(upserts, { onConflict: 'key' });
    if (error) throw error;

    // If any Telegram credential changed, drop the in-memory cache so the
    // next order picks up the new token/chat without a server restart.
    if (upserts.some((u) => u.key === 'telegram_bot_token' || u.key === 'telegram_chat_id')) {
      invalidateTelegramConfig();
    }

    // Same for WhatsApp Cloud API credentials / enable flag.
    if (upserts.some((u) => (
      u.key === 'whatsapp_access_token' ||
      u.key === 'whatsapp_phone_number_id' ||
      u.key === 'whatsapp_business_account_id' ||
      u.key === 'whatsapp_notifications_enabled'
    ))) {
      invalidateWhatsAppConfig();
    }

    // Any change to a public display key must bust the SSR cache of the
    // [locale] layout — otherwise storefront pages keep serving the pre-
    // rendered header with the old icons/logo until the next deploy.
    // We revalidate the layout so it re-fetches from the DB on the next
    // request. `revalidatePath('/', 'layout')` invalidates all descendants.
    const changedPublic = upserts.some((u) => PUBLIC_KEYS.includes(u.key));
    if (changedPublic) {
      try {
        revalidatePath('/', 'layout');
      } catch (e) {
        // Non-fatal — the client-side re-fetch in the header will still
        // pick up the new value on the next navigation.
        logger.warn('revalidatePath after settings PATCH failed', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err?.statusCode === 401 || err?.message?.toLowerCase().includes('unauthorized') || err?.message?.toLowerCase().includes('logged in')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('PATCH /api/v1/settings', err);
    return NextResponse.json({ success: false, error: 'Failed to save settings' }, { status: 500 });
  }
}
