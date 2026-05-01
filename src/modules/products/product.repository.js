import { createClient } from '@/lib/supabase/server';

const PRODUCT_SELECT = `
  *,
  categories (id, name, slug),
  product_images (id, url, storage_path, is_main, display_order)
`.trim();

export class ProductRepository {
  async findAll({ status, featured, limit } = {}) {
    const supabase = await createClient();
    let query = supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (status && status !== 'all') query = query.eq('status', status);
    if (featured === true) query = query.eq('is_featured', true);
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return data;
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