/**
 * Server-side sanitizer for the product `seo` JSONB payload.
 *
 * Strips HTML, clamps lengths, drops invalid URLs and coerces booleans so we
 * never persist unsafe or malformed SEO data. Returns `null` when nothing
 * meaningful is provided, keeping the column clean.
 */

import { locales } from '@/i18n/config';
import { stripHtml, isValidHttpUrl, slugify } from './resolve';

const MAX = {
  title: 300,
  description: 600,
  keywords: 300,
  og_title: 200,
  og_description: 400,
};

function cleanText(value, max) {
  if (value == null) return '';
  return stripHtml(String(value)).slice(0, max).trim();
}

function cleanUrl(value) {
  const str = String(value ?? '').trim();
  return isValidHttpUrl(str) ? str : '';
}

function cleanLocaleBlock(block) {
  if (!block || typeof block !== 'object') return null;
  const out = {};
  const title = cleanText(block.title, MAX.title);
  const description = cleanText(block.description, MAX.description);
  const keywords = cleanText(block.keywords, MAX.keywords);
  const ogTitle = cleanText(block.og_title, MAX.og_title);
  const ogDescription = cleanText(block.og_description, MAX.og_description);
  if (title) out.title = title;
  if (description) out.description = description;
  if (keywords) out.keywords = keywords;
  if (ogTitle) out.og_title = ogTitle;
  if (ogDescription) out.og_description = ogDescription;
  return Object.keys(out).length ? out : null;
}

/** @returns {object|null} sanitized seo object, or null when empty. */
export function sanitizeProductSeo(input) {
  if (!input || typeof input !== 'object') return null;

  const out = {};

  const title = cleanText(input.title, MAX.title);
  const description = cleanText(input.description, MAX.description);
  const keywords = cleanText(input.keywords, MAX.keywords);
  const ogTitle = cleanText(input.og_title, MAX.og_title);
  const ogDescription = cleanText(input.og_description, MAX.og_description);
  const canonical = cleanUrl(input.canonical_url);
  const ogImage = cleanUrl(input.og_image);

  if (title) out.title = title;
  if (description) out.description = description;
  if (keywords) out.keywords = keywords;
  if (ogTitle) out.og_title = ogTitle;
  if (ogDescription) out.og_description = ogDescription;
  if (canonical) out.canonical_url = canonical;
  if (ogImage) out.og_image = ogImage;
  if (input.no_index === true || input.no_index === 'true') out.no_index = true;
  if (input.no_follow === true || input.no_follow === 'true') out.no_follow = true;

  if (input.translations && typeof input.translations === 'object') {
    const translations = {};
    for (const loc of locales) {
      const block = cleanLocaleBlock(input.translations[loc]);
      if (block) translations[loc] = block;
    }
    if (Object.keys(translations).length) out.translations = translations;
  }

  return Object.keys(out).length ? out : null;
}

/**
 * Produce a stored slug: prefer an explicit admin value, otherwise derive from
 * the product name. Returns '' when neither yields a usable slug (caller may
 * then leave the column null and fall back to the UUID at read time).
 */
export function normalizeProductSlug(rawSlug, name) {
  const explicit = slugify(rawSlug);
  if (explicit) return explicit;
  return slugify(name);
}
