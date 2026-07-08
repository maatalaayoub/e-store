import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

const PUBLIC_KEYS = [
  'product_card_button_style', 'product_card_filled_bg', 'product_card_filled_text',
  'product_card_outline_border', 'product_card_outline_text', 'product_card_outline_icon',
  'product_card_outline_bg', 'product_card_button_font_size', 'product_card_layout',
  'product_card_show_short_description', 'product_card_hide_buttons',
  'carousel_items_mobile', 'carousel_items_tablet', 'carousel_items_desktop',
  'carousel_products_per_row', 'carousel_autoplay', 'carousel_interval', 'carousel_speed',
  'hero_type',
  // Contact info shown on the public contact page
  'contact_email', 'contact_phone', 'contact_whatsapp', 'contact_address',
  // Footer / general
  'store_name',
  'store_description',
  'show_social_whatsapp',
  'show_social_instagram',
  'show_social_facebook',
  'show_social_tiktok',
  'social_whatsapp',
  'social_instagram',
  'social_facebook',
  'social_tiktok',
];
const DEFAULTS = {
  product_card_button_style: 'add_to_cart',
  product_card_filled_bg: '#18181b',
  product_card_filled_text: '#ffffff',
  product_card_outline_border: '#18181b',
  product_card_outline_text: '#18181b',
  product_card_outline_icon: '#18181b',
  product_card_outline_bg: 'transparent',
  product_card_button_font_size: '10',
  product_card_layout: 'overlay',
  product_card_show_short_description: 'false',
  product_card_hide_buttons: 'false',
  carousel_items_mobile: '2',
  carousel_items_tablet: '3',
  carousel_items_desktop: '4',
  carousel_products_per_row: '8',
  carousel_autoplay: 'true',
  carousel_interval: '3000',
  carousel_speed: '500',
  hero_type: 'slider',
  contact_email: '',
  contact_phone: '',
  contact_whatsapp: '',
  contact_address: '',
  store_name: 'My store',
  store_description: '',
  show_social_whatsapp: 'true',
  show_social_instagram: 'true',
  show_social_facebook: 'true',
  show_social_tiktok: 'true',
  social_whatsapp: '',
  social_instagram: '',
  social_facebook: '',
  social_tiktok: '',
};

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
      // Short cache so admin toggles propagate fast, but the SWR window
      // keeps the storefront snappy under burst load.
      headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=3600' },
    });
  } catch {
    return NextResponse.json({ success: true, data: { ...DEFAULTS } });
  }
}
