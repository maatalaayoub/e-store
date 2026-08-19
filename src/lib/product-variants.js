/**
 * Product variant helpers (RAM / Storage / combination configurations).
 *
 * Variants are stored on products.variants as:
 *   {
 *     ram_enabled: boolean,
 *     storage_enabled: boolean,
 *     ram_options: string[],       // e.g. ["8 GB","12 GB"]
 *     storage_options: string[],   // e.g. ["128 GB","256 GB"]
 *     combos: [{
 *       ram?: string, storage?: string,
 *       additional_price: number,  // fixed amount added to the base price (MAD)
 *       stock: number,
 *       sku: string,
 *       available: boolean,
 *     }]
 *   }
 *
 * Additional price is a fixed delta on top of the product's effective base
 * price. The final price for a selected combo is computed by
 * `computeVariantPrice(baseEffective, combo)`. Everything is sanitized
 * server-side; client-supplied prices are never trusted.
 */

const MAX_OPTIONS = 20;
const MAX_COMBOS = 200;
const MAX_LABEL = 40;
const MAX_SKU = 60;

function cleanLabel(v) {
  return typeof v === 'string' ? v.trim().slice(0, MAX_LABEL) : '';
}

function uniqueLabels(arr) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(arr) ? arr : []) {
    const label = cleanLabel(raw);
    if (label && !seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      out.push(label);
    }
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}

function nonNegNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function nonNegInt(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Stable key for a combo across the active dimensions. */
export function comboKey(combo, ramEnabled, storageEnabled) {
  return [
    ramEnabled ? combo?.ram ?? '' : '',
    storageEnabled ? combo?.storage ?? '' : '',
  ].join('|');
}

/**
 * Sanitize a raw variants object. Drops variants that don't apply, clamps
 * numbers, keeps only combos whose dimension values exist in the option lists.
 * Returns null when there are no usable variants.
 */
export function sanitizeVariants(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const ramEnabled = raw.ram_enabled === true;
  const storageEnabled = raw.storage_enabled === true;
  if (!ramEnabled && !storageEnabled) return null;

  const ramOptions = ramEnabled ? uniqueLabels(raw.ram_options) : [];
  const storageOptions = storageEnabled ? uniqueLabels(raw.storage_options) : [];
  if (ramEnabled && ramOptions.length === 0) return null;
  if (storageEnabled && storageOptions.length === 0) return null;

  const ramSet = new Set(ramOptions.map((s) => s.toLowerCase()));
  const storageSet = new Set(storageOptions.map((s) => s.toLowerCase()));

  const seen = new Set();
  const combos = [];
  for (const raw2 of Array.isArray(raw.combos) ? raw.combos : []) {
    const ram = ramEnabled ? cleanLabel(raw2?.ram) : '';
    const storage = storageEnabled ? cleanLabel(raw2?.storage) : '';
    if (ramEnabled && !ramSet.has(ram.toLowerCase())) continue;
    if (storageEnabled && !storageSet.has(storage.toLowerCase())) continue;

    const key = comboKey({ ram, storage }, ramEnabled, storageEnabled);
    if (seen.has(key)) continue;
    seen.add(key);

    combos.push({
      ...(ramEnabled ? { ram } : {}),
      ...(storageEnabled ? { storage } : {}),
      additional_price: nonNegNumber(raw2?.additional_price),
      stock: nonNegInt(raw2?.stock),
      sku: typeof raw2?.sku === 'string' ? raw2.sku.trim().slice(0, MAX_SKU) : '',
      available: raw2?.available !== false,
    });
    if (combos.length >= MAX_COMBOS) break;
  }

  if (combos.length === 0) return null;

  return {
    ram_enabled: ramEnabled,
    storage_enabled: storageEnabled,
    ram_options: ramOptions,
    storage_options: storageOptions,
    combos,
  };
}

/** Find the combo matching a buyer selection ({ ram?, storage? }), or null. */
export function findVariantCombo(variants, selection) {
  if (!variants || !Array.isArray(variants.combos)) return null;
  const wantRam = variants.ram_enabled ? cleanLabel(selection?.ram) : '';
  const wantStorage = variants.storage_enabled ? cleanLabel(selection?.storage) : '';
  return (
    variants.combos.find(
      (c) =>
        (!variants.ram_enabled || c.ram === wantRam) &&
        (!variants.storage_enabled || c.storage === wantStorage),
    ) ?? null
  );
}

/** Final unit price for a combo = base effective price + fixed additional price. */
export function computeVariantPrice(baseEffective, combo) {
  const base = Number(baseEffective) || 0;
  const add = combo ? nonNegNumber(combo.additional_price) : 0;
  return Math.round((base + add) * 100) / 100;
}

/** True when a product has at least one usable variant combo. */
export function hasVariants(variants) {
  return !!(variants && Array.isArray(variants.combos) && variants.combos.length > 0);
}
