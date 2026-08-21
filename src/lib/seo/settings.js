/**
 * Server-side reader for store-wide SEO settings.
 *
 * Reads the `seo_*` keys (plus a few existing branding/social keys) from
 * `store_settings` and returns a normalized object consumed by the metadata
 * and JSON-LD builders. Wrapped in React `cache()` so a single request that
 * generates metadata *and* renders the page hits the database only once.
 */

import { cache } from 'react';
import { createServiceClient } from '@/lib/supabase/service';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { SEO_SETTING_KEYS, SEO_SETTING_DEFAULTS } from './constants';

// Extra keys reused from existing settings for site identity / structured data.
const EXTRA_KEYS = [
  'store_name',
  'store_logo',
  'payments_currency',
  'social_whatsapp',
  'social_instagram',
  'social_facebook',
  'social_tiktok',
];

const toBool = (value, fallback) => {
  if (value == null || value === '') return fallback;
  return value === true || value === 'true';
};

/** Resolve the canonical site origin (no trailing slash). */
export function resolveSiteUrl(raw) {
  const value = String(raw || env.NEXT_PUBLIC_SITE_URL || '').trim();
  return value.replace(/\/+$/, '');
}

function normalizeSeoSettings(map) {
  const get = (key) => (map[key] ?? SEO_SETTING_DEFAULTS[key] ?? '');
  const siteUrl = resolveSiteUrl(map.seo_site_url);

  const socialLinks = [
    map.social_facebook,
    map.social_instagram,
    map.social_tiktok,
    map.social_whatsapp,
  ].filter((v) => v && String(v).trim());

  return {
    siteName: (map.seo_site_name || map.store_name || '').trim(),
    siteUrl,
    defaultTitle: get('seo_default_title'),
    titleTemplate: get('seo_title_template'),
    defaultDescription: get('seo_default_description'),
    defaultKeywords: get('seo_default_keywords'),
    ogTitle: get('seo_og_title'),
    ogDescription: get('seo_og_description'),
    defaultOgImage: get('seo_og_image'),
    twitterCard: get('seo_twitter_card'),
    twitterSite: get('seo_twitter_site'),
    defaultIndex: toBool(map.seo_default_index, true),
    defaultFollow: toBool(map.seo_default_follow, true),
    favicon: get('seo_favicon'),
    logo: (map.store_logo || '').trim(),
    currency: (map.payments_currency || 'MAD').trim().toUpperCase(),
    socialLinks,
  };
}

/**
 * Read + normalize store SEO settings. Always resolves to a complete object;
 * on any failure it falls back to defaults so metadata never breaks.
 */
export const getSeoSettings = cache(async () => {
  try {
    const supabase = createServiceClient();
    const keys = [...SEO_SETTING_KEYS, ...EXTRA_KEYS];
    const { data, error } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', keys);

    if (error) {
      logger?.warn?.('[seo] failed to read store settings:', error.message);
      return normalizeSeoSettings({});
    }

    const map = {};
    for (const row of data ?? []) map[row.key] = row.value;
    return normalizeSeoSettings(map);
  } catch (err) {
    logger?.warn?.('[seo] getSeoSettings error:', err?.message);
    return normalizeSeoSettings({});
  }
});
