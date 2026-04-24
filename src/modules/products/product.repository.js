import { createClient } from '@/lib/supabase/server';

export class ProductRepository {
  async findAll() {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('products')
      .select('*');
    if (error) throw error;
    return data;
  }

  async findById(id) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
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
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export const productRepository = new ProductRepository();