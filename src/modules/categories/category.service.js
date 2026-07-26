import { categoryRepository, CATEGORY_IMAGE_BUCKET } from './category.repository';
import { createClient } from '@/lib/supabase/server';

const SUPPORTED_LOCALES = ['en', 'fr', 'ar', 'dr'];
const MAX_NAME_LEN = 80;

function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validate + normalise the per-locale translations map.
 *
 * Accepts `null` / `undefined` (caller doesn't want to touch the field), an
 * object shaped like `{ en: { name }, fr: { name }, ... }`, or an empty object
 * (which clears translations). Locales outside `SUPPORTED_LOCALES` are silently
 * dropped; empty / whitespace-only names are stripped so we never persist noise.
 * Throws on malformed input so route handlers can surface a 400.
 */
function sanitizeTranslations(input) {
  if (input == null) return undefined; // "leave the DB value alone"
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('translations must be an object');
  }
  const out = {};
  for (const locale of SUPPORTED_LOCALES) {
    const entry = input[locale];
    if (entry == null) continue;
    if (typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`translations.${locale} must be an object`);
    }
    const raw = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!raw) continue;
    if (raw.length > MAX_NAME_LEN) {
      throw new Error(`translations.${locale}.name is too long (max ${MAX_NAME_LEN})`);
    }
    out[locale] = { name: raw };
  }
  return out;
}

/**
 * Guard against path-traversal / non-image files. Category icons live under
 * `categories/…` inside the shared `product-images` bucket.
 */
function sanitizeImagePath(path) {
  if (path == null) return null; // caller wants to clear the image
  if (typeof path !== 'string') throw new Error('image_path must be a string');
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (
    trimmed.length > 500 ||
    trimmed.startsWith('/') ||
    trimmed.includes('..') ||
    /[\x00-\x1f\\]/.test(trimmed) // eslint-disable-line no-control-regex
  ) {
    throw new Error('invalid image_path');
  }
  if (!trimmed.startsWith('categories/')) {
    throw new Error('image_path must start with "categories/"');
  }
  if (!/\.(?:jpe?g|png|webp|avif|gif|svg)$/i.test(trimmed)) {
    throw new Error('unsupported image type');
  }
  return trimmed;
}

async function publicUrlFor(path) {
  if (!path) return null;
  const supabase = await createClient();
  return supabase.storage.from(CATEGORY_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export class CategoryService {
  async getCategories() {
    return categoryRepository.findAll();
  }

  async getCategoriesWithCounts() {
    return categoryRepository.findAllWithCounts();
  }

  async createCategory({ name, image_path = null, translations = null }) {
    if (!name?.trim()) throw new Error('Category name is required');
    const cleanedPath = sanitizeImagePath(image_path);
    const image_url = await publicUrlFor(cleanedPath);
    const cleanedTranslations = sanitizeTranslations(translations);
    // Slug from the canonical name. If the name contains only non-Latin script
    // (e.g. Arabic-only), toSlug returns an empty string — fall back to a random
    // suffix so the UNIQUE constraint doesn't collide on empty slugs.
    let slug = toSlug(name);
    if (!slug) slug = `category-${crypto.randomUUID().slice(0, 8)}`;
    return categoryRepository.create({
      name: name.trim(),
      slug,
      image_url,
      image_path: cleanedPath,
      translations: cleanedTranslations ?? {},
    });
  }

  /**
   * Partial update. `patch` may include:
   *   - name: string        → renames + reslugs
   *   - image_path: string  → replaces the icon (also derives image_url)
   *   - image_path: null    → clears the icon
   *   - translations: object → replaces the per-locale name map (whole-value)
   */
  async updateCategory(id, patch) {
    if (!id) throw new Error('Category id is required');
    if (!patch || typeof patch !== 'object') throw new Error('Nothing to update');

    const existing = await categoryRepository.findById(id);
    if (!existing) throw new Error('Category not found');

    const dbPatch = {};

    if ('name' in patch) {
      const name = patch.name?.trim();
      if (!name) throw new Error('Category name is required');
      dbPatch.name = name;
      let slug = toSlug(name);
      if (!slug) slug = `category-${crypto.randomUUID().slice(0, 8)}`;
      dbPatch.slug = slug;
    }

    if ('translations' in patch) {
      const cleaned = sanitizeTranslations(patch.translations);
      // Explicit whole-value replace (undefined means "not touched"; empty
      // object means "clear all translations").
      dbPatch.translations = cleaned ?? {};
    }

    let oldImagePathToDelete = null;
    if ('image_path' in patch) {
      const cleaned = sanitizeImagePath(patch.image_path);
      dbPatch.image_path = cleaned;
      dbPatch.image_url  = await publicUrlFor(cleaned);
      // If the file actually changed (or was cleared), plan to remove the old one.
      if (existing.image_path && existing.image_path !== cleaned) {
        oldImagePathToDelete = existing.image_path;
      }
    }

    if (Object.keys(dbPatch).length === 0) return existing;

    const updated = await categoryRepository.update(id, dbPatch);
    if (oldImagePathToDelete) {
      await categoryRepository.removeStorageObject(oldImagePathToDelete);
    }
    return updated;
  }

  async deleteCategory(id) {
    if (!id) throw new Error('Category id is required');
    // products.category_id has ON DELETE SET NULL — no need to reassign first.
    await categoryRepository.delete(id);
  }
}

export const categoryService = new CategoryService();
