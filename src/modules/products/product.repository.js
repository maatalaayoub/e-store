import { createClient } from '@/lib/supabase/server';

// Full payload — used for admin edit screens and the product detail page,
// where the client needs every column and every image.
const PRODUCT_SELECT = `
  *,
  categories (id, name, slug),
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
  translations,
  colors,
  sizes,
  created_at,
  categories (id, name, slug),
  product_images (id, url, is_main, display_order)
`.trim();

const PRODUCT_LIST_FALLBACK_SELECT = `
  id,
  name,
  price,
  status,
  stock,
  is_featured,
  created_at,
  categories (id, name, slug),
  product_images (id, url, is_main, display_order)
`.trim();

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

  async create(productData) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('products')
      .insert(productData)
      .select(PRODUCT_SELECT)
      .single();
    if (error) throw error;
    return data;
  }

  async update(id, productData) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('products')
      .update(productData)
      .eq('id', id)
      .select(PRODUCT_SELECT)
      .single();
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