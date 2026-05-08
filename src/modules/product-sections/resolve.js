/**
 * Resolve the EFFECTIVE sections array for a product:
 *   - if `use_default_sections` is true (or per-product config is null),
 *     return the global defaults
 *   - otherwise return the per-product `sections_config`
 *
 * Also applies per-locale translation overrides on each section's `content`.
 */

import { sanitizeSections } from './sanitize';
import { getBuiltInDefaults, getRegistryEntry } from './registry';

/**
 * Apply translations[locale] over each section's content.
 */
export function applySectionLocale(sections, locale) {
  if (!locale || !Array.isArray(sections)) return sections;
  return sections.map((s) => {
    const tr = s?.translations?.[locale];
    if (!tr) return s;
    const entry = getRegistryEntry(s.type);
    const translatable = entry?.translatableFields ?? [];
    const merged = { ...s.content };
    for (const field of translatable) {
      if (tr[field] != null && tr[field] !== '') merged[field] = tr[field];
    }
    return { ...s, content: merged };
  });
}

/**
 * Pick the active sections for a product.
 *
 * @param {object} product           — normalized product (must include
 *                                     `use_default_sections`, `sections_config`)
 * @param {Array}  globalDefaults    — sanitized global defaults array
 * @param {string} [locale]          — locale to resolve translations against
 * @param {object} [opts]
 * @param {boolean} [opts.includeDisabled=false]  — include enabled=false entries
 *                                                  (admin preview only)
 */
export function resolveProductSections(product, globalDefaults, locale, opts = {}) {
  if (!product) return [];

  const usingDefaults =
    product.use_default_sections !== false ||
    !product.sections_config ||
    (Array.isArray(product.sections_config) && product.sections_config.length === 0);

  let raw = usingDefaults
    ? (Array.isArray(globalDefaults) ? globalDefaults : [])
    : (Array.isArray(product.sections_config) ? product.sections_config : []);

  // Empty global defaults → fall back to the original page layout so existing
  // installations look identical until the admin configures something.
  if (raw.length === 0) raw = getBuiltInDefaults();

  const sorted = [...raw].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const visible = opts.includeDisabled ? sorted : sorted.filter((s) => s.enabled !== false);
  return applySectionLocale(visible, locale);
}

export { sanitizeSections };
