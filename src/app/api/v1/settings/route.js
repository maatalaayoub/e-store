import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/middlewares/authGuard';

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
  'carousel_items_mobile',
  'carousel_items_tablet',
  'carousel_items_desktop',
  'carousel_products_per_row',
  'carousel_autoplay',
  'carousel_interval',
  'carousel_speed',
];

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
      console.warn('[GET /api/v1/settings] DB error (table may not exist yet):', error.message);
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
    console.error('[GET /api/v1/settings]', err?.message ?? err);
    return NextResponse.json({ success: false, error: 'Failed to load settings' }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/settings
 * Upsert store settings — admin only.
 * Body: { telegram_bot_token?, telegram_chat_id?, whatsapp_number?, whatsapp_business_name? }
 */
export async function PATCH(req) {
  try {
    await requireAdmin();

    const body = await req.json();
    const upserts = Object.entries(body)
      .filter(([k]) => ALLOWED_KEYS.includes(k))
      .map(([key, value]) => ({
        key,
        // Hard-bound the stored value so a typo / pasted blob can't bloat
        // the settings table.
        value: String(value ?? '').slice(0, 1000),
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

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err?.statusCode === 401 || err?.message?.toLowerCase().includes('unauthorized') || err?.message?.toLowerCase().includes('logged in')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[PATCH /api/v1/settings]', err?.message ?? err);
    return NextResponse.json({ success: false, error: 'Failed to save settings' }, { status: 500 });
  }
}
