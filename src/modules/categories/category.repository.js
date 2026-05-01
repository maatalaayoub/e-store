import { createClient } from '@/lib/supabase/server';

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

  async create({ name, slug }) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, slug })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export const categoryRepository = new CategoryRepository();
