/**
 * SEO constants — shared between client (admin previews / validation) and
 * server (metadata generation). This module must stay free of server-only
 * imports so it can be bundled into client components.
 */

/** Recommended length windows used by the SEO validator and previews. */
export const SEO_LIMITS = {
  title: { min: 30, max: 60, hardMax: 70 },
  description: { min: 70, max: 160, hardMax: 320 },
  slug: { max: 96 },
  ogTitle: { max: 90 },
  ogDescription: { max: 200 },
};

/** store_settings keys that hold store-wide SEO configuration. */
export const SEO_SETTING_KEYS = [
  'seo_site_name',
  'seo_site_url',
  'seo_default_title',
  'seo_title_template',
  'seo_default_description',
  'seo_default_keywords',
  'seo_og_title',
  'seo_og_description',
  'seo_og_image',
  'seo_twitter_card',
  'seo_twitter_site',
  'seo_default_index',
  'seo_default_follow',
  'seo_favicon',
];

/** Sensible fallbacks so metadata is never broken when settings are empty. */
export const SEO_SETTING_DEFAULTS = {
  seo_site_name: '',
  seo_site_url: '',
  seo_default_title: '',
  seo_title_template: '%s | %site%',
  seo_default_description: '',
  seo_default_keywords: '',
  seo_og_title: '',
  seo_og_description: '',
  seo_og_image: '',
  seo_twitter_card: 'summary_large_image',
  seo_twitter_site: '',
  seo_default_index: 'true',
  seo_default_follow: 'true',
  seo_favicon: '',
};

export const TWITTER_CARD_TYPES = ['summary', 'summary_large_image'];
