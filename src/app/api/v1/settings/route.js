import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';
import { invalidateTelegramConfig } from '@/lib/telegram';
import { logger } from '@/lib/logger';

const ALLOWED_KEYS = [
  'telegram_bot_token',
  'telegram_chat_id',
  'whatsapp_number',
  'whatsapp_business_name',
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
  'store_logo_size',
  'store_logo_height',
];

// Per-key value size limits. Hero configs can hold long JSON (image URLs etc.).
const VALUE_MAX = {
  hero_single_config:    8000,
  hero_multi_config:     4000,
  hero_video_config:     6000,
  hero_countdown_config: 5000,
  hero_iherb_config:     60000,
};
const DEFAULT_VALUE_MAX = 1000;

/**
 * GET /api/v1/settings
 * Returns all store settings as { key: value } — admin only.
 */
export async function GET() {
  try {
    await requireAdmin();

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
    return NextResponse.json({ success: true, data: settings });
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
    await requireAdmin();

    const body = await req.json();
    const upserts = Object.entries(body)
      .filter(([k]) => ALLOWED_KEYS.includes(k))
      .map(([key, value]) => ({
        key,
        // Hard-bound the stored value so a typo / pasted blob can't bloat
        // the settings table. Config keys get a larger allowance for JSON.
        value: String(value ?? '').slice(0, VALUE_MAX[key] ?? DEFAULT_VALUE_MAX),
        updated_at: new Date().toISOString(),
      }));

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

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err?.statusCode === 401 || err?.message?.toLowerCase().includes('unauthorized') || err?.message?.toLowerCase().includes('logged in')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('PATCH /api/v1/settings', err);
    return NextResponse.json({ success: false, error: 'Failed to save settings' }, { status: 500 });
  }
}
