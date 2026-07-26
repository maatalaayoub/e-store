import { categoryRepository, CATEGORY_IMAGE_BUCKET } from './category.repository';
import { createClient } from '@/lib/supabase/server';

function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

  async createCategory({ name, image_path = null }) {
    if (!name?.trim()) throw new Error('Category name is required');
    const cleanedPath = sanitizeImagePath(image_path);
    const image_url = await publicUrlFor(cleanedPath);
    return categoryRepository.create({
      name: name.trim(),
      slug: toSlug(name),
      image_url,
      image_path: cleanedPath,
    });
  }

  /**
   * Partial update. `patch` may include:
   *   - name: string        → renames + reslugs
   *   - image_path: string  → replaces the icon (also derives image_url)
   *   - image_path: null    → clears the icon
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
      dbPatch.slug = toSlug(name);
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
