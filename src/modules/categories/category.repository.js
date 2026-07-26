import { createClient } from '@/lib/supabase/server';

const CATEGORY_IMAGE_BUCKET = 'product-images'; // shared bucket; category icons live under `categories/`

export class CategoryRepository {
  async findAll() {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data;
  }

  async findAllWithCounts() {
    const supabase = await createClient();
    // Fetch categories and product counts in parallel; group counts client-side
    // (Supabase JS doesn't expose a native GROUP BY, and this list is small).
    const [{ data: cats, error: catErr }, { data: prods, error: prodErr }] = await Promise.all([
      supabase.from('categories').select('*').order('name', { ascending: true }),
      supabase.from('products').select('category_id'),
    ]);
    if (catErr) throw catErr;
    if (prodErr) throw prodErr;
    const counts = new Map();
    for (const p of prods ?? []) {
      if (!p.category_id) continue;
      counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
    }
    return (cats ?? []).map((c) => ({ ...c, product_count: counts.get(c.id) ?? 0 }));
  }

  async findById(id) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async create({ name, slug, image_url = null, image_path = null, translations = null }) {
    const supabase = await createClient();
    const row = { name, slug, image_url, image_path };
    if (translations != null) row.translations = translations;
    const { data, error } = await supabase
      .from('categories')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(id, patch) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('categories')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id) {
    const supabase = await createClient();
    // Fetch the row first so we can clean up the storage object after the DB row is gone.
    const existing = await this.findById(id);
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) throw error;
    if (existing?.image_path) {
      await supabase.storage.from(CATEGORY_IMAGE_BUCKET).remove([existing.image_path]).catch(() => {});
    }
  }

  async removeStorageObject(path) {
    if (!path) return;
    const supabase = await createClient();
    await supabase.storage.from(CATEGORY_IMAGE_BUCKET).remove([path]).catch(() => {});
  }

  getPublicUrl(path) {
    // Public URL never varies per request — a fresh client is fine.
    // We use the server client because this runs from route handlers only.
    return createClient().then((s) => s.storage.from(CATEGORY_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl);
  }
}

export const categoryRepository = new CategoryRepository();
export { CATEGORY_IMAGE_BUCKET };
