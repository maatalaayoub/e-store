/**
 * Shared promo-code discount arithmetic.
 *
 * Used by:
 *   - POST /api/v1/promos/validate  — initial validation
 *   - POST /api/v1/orders           — server-side re-validation on order create
 *   - CheckoutClient                — client-side revalidation when the cart
 *                                     changes on the checkout page
 *
 * Keep the math in ONE place so client and server can never drift out of sync.
 */
/**
 * @param {object} promo
 * @param {'percentage_off'|'fixed_amount'} promo.discount_type
 * @param {number|string} promo.discount_value
 * @param {number} applicableSubtotal - MAD subtotal of items the promo covers.
 * @returns {number} Discount in MAD, capped at applicableSubtotal, rounded to 2dp.
 */
export function computePromoDiscount(promo, applicableSubtotal) {
  const subtotal = Math.max(0, Number(applicableSubtotal) || 0);
  if (subtotal <= 0) return 0;

  let discount = 0;
  if (promo.discount_type === 'percentage_off') {
    discount = (subtotal * Number(promo.discount_value)) / 100;
  } else {
    discount = Number(promo.discount_value);
  }

  return Math.round(Math.min(discount, subtotal) * 100) / 100;
}

/**
 * Whether the order subtotal falls within the promo's eligible range.
 * `min_order_amount` is a lower bound; `max_order_amount` (optional) an upper
 * bound — the promo only applies when subtotal is within [min, max].
 *
 * @param {{ min_order_amount?: number|string|null, max_order_amount?: number|string|null }} promo
 * @param {number} subtotal - order subtotal in MAD.
 * @returns {'ok'|'below_min'|'above_max'}
 */
export function checkPromoOrderRange(promo, subtotal) {
  const total = Number(subtotal) || 0;
  if (total < Number(promo.min_order_amount ?? 0)) return 'below_min';
  if (promo.max_order_amount != null && total > Number(promo.max_order_amount)) {
    return 'above_max';
  }
  return 'ok';
}
