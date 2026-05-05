/**
 * Parse a price value into a number.
 * Accepts numbers or strings (strips any non-numeric chars except `.`).
 * Returns 0 for invalid input.
 */
export function parsePrice(price) {
  if (typeof price === "number") return price;
  return parseFloat(String(price).replace(/[^0-9.]/g, "")) || 0;
}
