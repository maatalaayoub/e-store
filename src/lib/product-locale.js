/**
 * Resolves a product's name and descriptions from its `translations` JSONB field
 * based on the given locale. Falls back to the base name/descriptions if no
 * translation exists for that locale.
 *
 * @param {object} product
 * @param {string} locale  e.g. "en" | "fr" | "ar" | "dr"
 * @returns {object} product with name/descriptions overridden for the locale
 */
export function resolveProductTranslation(product, locale) {
  if (!product || !locale) return product;
  const tr = product.translations?.[locale];
  if (!tr) return product;
  return {
    ...product,
    name: tr.name || product.name,
    short_description: tr.short_description || product.short_description,
    description: tr.description || product.description,
  };
}
