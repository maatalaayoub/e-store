/**
 * Resolve a category's display name for the given locale.
 *
 * The DB row keeps a canonical top-level `name` (used for the slug + as the
 * ultimate fallback) plus a `translations` JSONB map of shape
 *   { en: { name }, fr: { name }, ar: { name }, dr: { name } }
 * — mirroring the pattern used by `products`.
 *
 * Falls back to `category.name` when no localized value exists so consumers
 * never render an empty string.
 *
 * @param {object|null|undefined} category
 * @param {string|null|undefined} locale  e.g. "en" | "fr" | "ar" | "dr"
 * @returns {string|null}
 */
export function resolveCategoryName(category, locale) {
  if (!category) return null;
  if (!locale) return category.name ?? null;
  const t = category.translations?.[locale]?.name;
  const trimmed = typeof t === "string" ? t.trim() : "";
  return trimmed || category.name || null;
}

// ── Shared helpers for the multi-language category name editor ─────────────
// Used by CategoriesManagerModal and the inline "+ New" form inside
// ProductFormModal so both flows stay consistent.

export const CATEGORY_SUPPORTED_LANGS = ["en", "fr", "ar", "dr"];

/** Fresh `{ en: "", fr: "", ar: "", dr: "" }`. */
export function emptyCategoryNames() {
  return Object.fromEntries(CATEGORY_SUPPORTED_LANGS.map((l) => [l, ""]));
}

/**
 * Pick the canonical top-level `name` from a per-locale name map. Walks
 * CATEGORY_SUPPORTED_LANGS in order so English wins when present (keeps slugs
 * Latin whenever possible); falls back to any non-empty translation.
 */
export function canonicalCategoryName(names) {
  for (const lang of CATEGORY_SUPPORTED_LANGS) {
    const v = names?.[lang]?.trim();
    if (v) return v;
  }
  return "";
}

/**
 * Serialise a per-locale name map to the API-shaped `translations` object.
 * Empty entries are dropped so we never persist noise into the JSONB column.
 */
export function categoryTranslationsPayload(names) {
  const out = {};
  for (const lang of CATEGORY_SUPPORTED_LANGS) {
    const v = names?.[lang]?.trim();
    if (v) out[lang] = { name: v };
  }
  return out;
}

/**
 * Seed a per-locale name map from an existing category row. If the row has no
 * translations yet, pre-fills the English slot with the canonical name so
 * admins editing a legacy row don't stare at an empty form.
 */
export function categoryNamesFromRow(cat) {
  const map = emptyCategoryNames();
  for (const lang of CATEGORY_SUPPORTED_LANGS) {
    const v = cat?.translations?.[lang]?.name;
    if (typeof v === "string" && v.trim()) map[lang] = v.trim();
  }
  const anyFilled = CATEGORY_SUPPORTED_LANGS.some((l) => map[l]);
  if (!anyFilled && cat?.name) map.en = cat.name;
  return map;
}

/** Shallow compare two name maps for equality (used to skip no-op saves). */
export function categoryNamesEqual(a, b) {
  for (const lang of CATEGORY_SUPPORTED_LANGS) {
    if ((a?.[lang] ?? "").trim() !== (b?.[lang] ?? "").trim()) return false;
  }
  return true;
}

