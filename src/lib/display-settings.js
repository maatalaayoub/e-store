/**
 * Display settings — shared between the public API route
 * (`/api/v1/display-settings`) and server-side callers that need the same
 * data during SSR (e.g. the locale layout, which hydrates a provider so the
 * shop header renders with the correct icons on first paint — no flicker).
 */

import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/logger';

export const PUBLIC_KEYS = [
  'product_card_button_style', 'product_card_filled_bg', 'product_card_filled_text',
  'product_card_outline_border', 'product_card_outline_text', 'product_card_outline_icon',
  'product_card_outline_bg', 'product_card_button_font_size', 'product_card_layout',
  'product_card_show_short_description', 'product_card_hide_buttons',
  'carousel_items_mobile', 'carousel_items_tablet', 'carousel_items_desktop',
  'carousel_products_per_row', 'carousel_autoplay', 'carousel_interval', 'carousel_speed',
  'hero_type',
  // Contact info shown on the public contact page
  'contact_email', 'contact_phone', 'contact_whatsapp', 'contact_address',
  'contact_lat', 'contact_lng',
  // Footer / general
  'store_name',
  'store_description',
  'store_logo',
  'store_logo_dark',
  'store_logo_size',
  'store_logo_height',
  // Storefront header + sidebar
  'header_cart_icon',
  'header_menu_icon',
  'sidebar_theme',
  // Mobile bottom navigation (hidden on lg+ screens)
  'mobile_nav_enabled',
  'mobile_nav_show_home',
  'mobile_nav_show_favorites',
  'mobile_nav_show_cart',
  'mobile_nav_show_account',
  'mobile_nav_show_orders',
  'mobile_nav_show_menu',
  'show_social_whatsapp',
  'show_social_instagram',
  'show_social_facebook',
  'show_social_tiktok',
  'social_whatsapp',
  'social_instagram',
  'social_facebook',
  'social_tiktok',
];

export const DEFAULTS = {
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
  store_logo: '',
  store_logo_dark: '',
  store_logo_size: '160',
  store_logo_height: '40',
  header_cart_icon: 'cart',
  header_menu_icon: 'menu',
  sidebar_theme: 'minimal',
  mobile_nav_enabled: 'true',
  mobile_nav_show_home: 'true',
  mobile_nav_show_favorites: 'true',
  mobile_nav_show_cart: 'true',
  mobile_nav_show_account: 'true',
  mobile_nav_show_orders: 'false',
  mobile_nav_show_menu: 'true',
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
 * Server-side reader for public display settings.
 * Always returns a complete object — falls back to DEFAULTS on any failure so
 * the caller can render without null-checks.
 */
export async function getDisplaySettings() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', PUBLIC_KEYS);

    if (error) return { ...DEFAULTS };

    const settings = { ...DEFAULTS };
    for (const row of data ?? []) {
      if (PUBLIC_KEYS.includes(row.key)) {
        settings[row.key] = row.value ?? DEFAULTS[row.key];
      }
    }
    return settings;
  } catch (err) {
    logger.error('getDisplaySettings', err);
    return { ...DEFAULTS };
  }
}
