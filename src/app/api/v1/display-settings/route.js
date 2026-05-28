import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

const PUBLIC_KEYS = ['product_card_button_style', 'product_card_filled_bg', 'product_card_filled_text', 'product_card_outline_border', 'product_card_outline_text', 'product_card_outline_icon', 'product_card_outline_bg', 'product_card_button_font_size', 'product_card_layout', 'product_card_show_short_description', 'carousel_items_mobile', 'carousel_items_tablet', 'carousel_items_desktop', 'carousel_products_per_row', 'carousel_autoplay', 'carousel_interval', 'carousel_speed'];
const DEFAULTS = { product_card_button_style: 'add_to_cart', product_card_filled_bg: '#18181b', product_card_filled_text: '#ffffff', product_card_outline_border: '#18181b', product_card_outline_text: '#18181b', product_card_outline_icon: '#18181b', product_card_outline_bg: 'transparent', product_card_button_font_size: '10', product_card_layout: 'overlay', product_card_show_short_description: 'false', carousel_items_mobile: '2', carousel_items_tablet: '3', carousel_items_desktop: '4', carousel_products_per_row: '8', carousel_autoplay: 'true', carousel_interval: '3000', carousel_speed: '500' };

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
