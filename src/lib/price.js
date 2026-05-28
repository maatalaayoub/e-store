/**
 * Parse a price value into a number.
 * Accepts numbers or strings (strips any non-numeric chars except `.`).
 * Returns 0 for invalid input.
 */
export function parsePrice(price) {
  if (typeof price === "number") return price;
  return parseFloat(String(price).replace(/[^0-9.]/g, "")) || 0;
}

/**
 * Single source of truth for "what does this product actually cost".
 *
 * Order of precedence:
 *   1. Explicit `discount_price` (admin set an absolute sale price).
 *   2. `discount_percentage` applied to the base `price` (e.g. 20% off).
 *   3. Base `price`.
 *
 * Returns a Number (never null). Callers that need to know whether a
 * discount was applied can compare `parsePrice(product.price)` with the
 * result, or call {@link computeDiscountInfo} below.
 *
 * @param {{ price?: number|string, discount_price?: number|string|null, discount_percentage?: number|null }} product
 * @returns {number}
 */
export function computeEffectivePrice(product) {
  if (!product) return 0;
  const base = parsePrice(product.price);
  if (product.discount_price != null && product.discount_price !== "") {
    const dp = parsePrice(product.discount_price);
    if (dp > 0 && dp < base) return dp;
  }
  const pct = Number(product.discount_percentage);
  if (Number.isFinite(pct) && pct > 0 && pct < 100) {
    return Math.round(base * (100 - pct)) / 100;
  }
  return base;
}

/**
 * Return { effective, original, hasDiscount, percent } for UI helpers.
 * `percent` is rounded to the nearest integer.
 */
export function computeDiscountInfo(product) {
  const original = parsePrice(product?.price);
  const effective = computeEffectivePrice(product);
  const hasDiscount = effective > 0 && effective < original;
  const percent = hasDiscount && original > 0
    ? Math.round(((original - effective) / original) * 100)
    : 0;
  return { effective, original, hasDiscount, percent };
}
