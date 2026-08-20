/**
 * Convert a decimal amount into the integer minor units Stripe expects.
 *
 * Most currencies use 2 decimal places (100 minor units), but Stripe treats a
 * set of currencies as zero-decimal (the amount is already in the smallest
 * unit) and a few as three-decimal. Getting this wrong would over/under-charge
 * by 100x, so the mapping is explicit.
 */

// Stripe zero-decimal currencies (amount is charged as-is, no *100).
const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG',
  'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

// Stripe three-decimal currencies (charged in thousandths, rounded to 10s).
const THREE_DECIMAL = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

/**
 * @param {number} amount   Human-readable amount (e.g. 49.99).
 * @param {string} currency ISO 4217 code (any case).
 * @returns {number} Positive integer in the currency's smallest unit.
 */
export function toStripeMinorUnits(amount, currency) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return 0;
  const code = String(currency || 'USD').toUpperCase();

  if (ZERO_DECIMAL.has(code)) {
    return Math.round(value);
  }
  if (THREE_DECIMAL.has(code)) {
    // Stripe requires the last digit to be 0 for three-decimal currencies.
    return Math.round(value * 1000 / 10) * 10;
  }
  return Math.round(value * 100);
}
