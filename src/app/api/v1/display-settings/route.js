import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

const PUBLIC_KEYS = ['product_card_button_style', 'product_card_filled_bg', 'product_card_filled_text', 'product_card_outline_border', 'product_card_outline_text', 'product_card_outline_icon', 'product_card_outline_bg', 'product_card_button_font_size', 'product_card_layout'];
const DEFAULTS = { product_card_button_style: 'add_to_cart', product_card_filled_bg: '#18181b', product_card_filled_text: '#ffffff', product_card_outline_border: '#18181b', product_card_outline_text: '#18181b', product_card_outline_icon: '#18181b', product_card_outline_bg: 'transparent', product_card_button_font_size: '10', product_card_layout: 'overlay' };

/**
 * GET /api/v1/display-settings
 * Returns public display settings used by shop-facing components.
 * No authentication required — only non-sensitive display preferences.
 */
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', PUBLIC_KEYS);

    if (error) {
      return NextResponse.json({ success: true, data: { ...DEFAULTS } });
    }

    const settings = { ...DEFAULTS };
    for (const row of data ?? []) {
      if (PUBLIC_KEYS.includes(row.key)) {
        settings[row.key] = row.value ?? DEFAULTS[row.key];
      }
    }

    return NextResponse.json({ success: true, data: settings }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ success: true, data: { ...DEFAULTS } });
  }
}
