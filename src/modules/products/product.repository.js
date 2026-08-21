import { createClient } from '@/lib/supabase/server';

// Full payload — used for admin edit screens and the product detail page,
// where the client needs every column and every image.
const PRODUCT_SELECT = `
  *,
  categories (id, name, slug, translations),
  product_images (id, url, storage_path, is_main, display_order)
`.trim();

// Slim payload — used for listing screens (shop grid, featured rails,
// search results). Avoids dragging long_description / metadata over the
// wire for every card, and limits images to the main one.
const PRODUCT_LIST_SELECT = `
  id,
  name,
  short_description,
  price,
  discount_price,
  discount_percentage,
  status,
  stock,
  is_featured,
  category_id,
  translations,
  colors,
  sizes,
  created_at,
  categories (id, name, slug, translations),
  product_images (id, url, is_main, display_order)
`.trim();

const PRODUCT_LIST_FALLBACK_SELECT = `
  id,
  name,
  price,
  status,
  stock,
  is_featured,
  category_id,
  created_at,
  categories (id, name, slug, translations),
  product_images (id, url, is_main, display_order)
`.trim();

/** True when Postgres/PostgREST reports an unknown column (safe-rollout path). */
function isMissingColumnError(error) {
  return error?.code === '42703' || /column .* does not exist/i.test(error?.message ?? '');
}

/**
 * Drop the specific unknown column named in a 42703 error so a write can be
 * retried on a database that hasn't run the latest migration yet. Returns a
 * new payload, or null when no known column name could be extracted.
 */
function stripUnknownColumns(payload, error) {
  const match = /column "?([a-z0-9_]+)"?/i.exec(error?.message ?? '');
  const col = match?.[1];
  if (!col || !(col in payload)) return null;
  const { [col]: _removed, ...rest } = payload;
  return rest;
}

export class ProductRepository {
  async findAll({ status, featured, limit, offset, ids } = {}) {
    const supabase = await createClient();
    const runQuery = async (select) => {
      let query = supabase
        .from('products')
        .select(select)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (status && status !== 'all') query = query.eq('status', status);
      if (featured === true) query = query.eq('is_featured', true);

      // Filter by a specific set of IDs (used for live cart price reconciliation).
      const productIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
      if (productIds.length > 0) {
        query = query.in('id', productIds.slice(0, 100));
      }

      // Offset + limit translate to PostgREST `range(from, to)`; we apply
      // `limit` directly when no offset is provided to keep older callers
      // working.
      if (offset != null && limit != null) {
        query = query.range(offset, offset + limit - 1);
      } else if (limit != null) {
        query = query.limit(limit);
      }

      return query;
    };

    const { data, error } = await runQuery(PRODUCT_LIST_SELECT);
    if (!error) return data;

    const missingColumn = error.code === '42703' || /column .* does not exist/i.test(error.message ?? '');
    if (!missingColumn) throw error;

    console.warn('[products] falling back to legacy product select:', error.message);
    const fallback = await runQuery(PRODUCT_LIST_FALLBACK_SELECT);
    if (fallback.error) throw fallback.error;
    return fallback.data;
  }

  async findById(id) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  /** Resolve a product by its UUID or, failing that, its SEO slug. */
  async findByIdOrSlug(idOrSlug) {
    if (!idOrSlug) return null;
    const supabase = await createClient();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const column = isUuid ? 'id' : 'slug';
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq(column, idOrSlug)
      .maybeSingle();

    // A newer install may not have the slug column yet — treat as not found
    // rather than throwing, so lookups degrade gracefully.
    if (error) {
      if (!isUuid && isMissingColumnError(error)) return null;
      throw error;
    }
    if (data || isUuid) return data;

    // Fall back to UUID lookup in case a slug-looking value is actually an id.
    const byId = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('id', idOrSlug)
      .maybeSingle();
    if (byId.error) return null;
    return byId.data;
  }

  /** True when another product already uses `slug` (excluding `excludeId`). */
  async slugExists(slug, excludeId) {
    if (!slug) return false;
    const supabase = await createClient();
    let query = supabase.from('products').select('id').eq('slug', slug).limit(1);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query;
    if (error) {
      // Column not migrated yet → treat as no collision.
      if (isMissingColumnError(error)) return false;
      throw error;
    }
    return Array.isArray(data) && data.length > 0;
  }

  /** Minimal set of active products for building sitemap.xml. */
  async findAllForSitemap() {
    const supabase = await createClient();
    const run = (select) =>
      supabase
        .from('products')
        .select(select)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(5000);

    let { data, error } = await run('id, slug, updated_at');
    if (error && isMissingColumnError(error)) {
      ({ data, error } = await run('id, updated_at'));
    }
    if (error && isMissingColumnError(error)) {
      ({ data, error } = await run('id'));
    }
    if (error) throw error;
    return data ?? [];
  }

  async create(productData) {
    const supabase = await createClient();
    const attempt = (payload) =>
      supabase.from('products').insert(payload).select(PRODUCT_SELECT).single();

    let { data, error } = await attempt(productData);
    if (error && isMissingColumnError(error)) {
      // Roll out safely if a newer column (e.g. product_type) isn't migrated yet.
      const stripped = stripUnknownColumns(productData, error);
      if (stripped) ({ data, error } = await attempt(stripped));
    }
    if (error) throw error;
    return data;
  }

  async update(id, productData) {
    const supabase = await createClient();
    const attempt = (payload) =>
      supabase.from('products').update(payload).eq('id', id).select(PRODUCT_SELECT).single();

    let { data, error } = await attempt(productData);
    if (error && isMissingColumnError(error)) {
      const stripped = stripUnknownColumns(productData, error);
      if (stripped) ({ data, error } = await attempt(stripped));
    }
    if (error) throw error;
    return data;
  }

  async delete(id) {
    const supabase = await createClient();
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  }

  // ── Image management ──

  async addImage(productId, { url, storagePath, isMain = false, displayOrder = 0 }) {
    const supabase = await createClient();

    // If this image is main, unset any existing main first
    if (isMain) {
      await supabase
        .from('product_images')
        .update({ is_main: false })
        .eq('product_id', productId)
        .eq('is_main', true);
    }

    const { data, error } = await supabase
      .from('product_images')
      .insert({ product_id: productId, url, storage_path: storagePath, is_main: isMain, display_order: displayOrder })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async setMainImage(productId, imageId) {
    const supabase = await createClient();
    // Unset current main
    await supabase
      .from('product_images')
      .update({ is_main: false })
      .eq('product_id', productId)
      .eq('is_main', true);
    // Set new main
    const { data, error } = await supabase
      .from('product_images')
      .update({ is_main: true })
      .eq('id', imageId)
      .eq('product_id', productId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async replaceImage(productId, imageId, { url, storagePath }) {
    const supabase = await createClient();

    // Fetch old image to delete its storage file after DB update
    const { data: oldImg, error: fetchErr } = await supabase
      .from('product_images')
      .select('storage_path, is_main')
      .eq('id', imageId)
      .eq('product_id', productId)
      .single();
    if (fetchErr) throw fetchErr;

    const { data, error } = await supabase
      .from('product_images')
      .update({ url, storage_path: storagePath })
      .eq('id', imageId)
      .eq('product_id', productId)
      .select()
      .single();
    if (error) throw error;

    if (oldImg?.storage_path && oldImg.storage_path !== storagePath) {
      await supabase.storage.from('product-images').remove([oldImg.storage_path]);
    }

    return data;
  }

  async deleteImage(productId, imageId) {
    const supabase = await createClient();
    const { data: img, error: fetchErr } = await supabase
      .from('product_images')
      .select('storage_path, is_main')
      .eq('id', imageId)
      .eq('product_id', productId)
      .single();
    if (fetchErr) throw fetchErr;

    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('id', imageId)
      .eq('product_id', productId);
    if (error) throw error;

    // Remove from storage
    if (img?.storage_path) {
      await supabase.storage.from('product-images').remove([img.storage_path]);
    }

    // If deleted image was main, promote the first remaining image
    if (img?.is_main) {
      const { data: remaining } = await supabase
        .from('product_images')
        .select('id')
        .eq('product_id', productId)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (remaining) {
        await supabase
          .from('product_images')
          .update({ is_main: true })
          .eq('id', remaining.id);
      }
    }
  }
}

export const productRepository = new ProductRepository();