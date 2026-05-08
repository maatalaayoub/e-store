/**
 * Repository for the global product-section defaults singleton.
 */

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export class ProductSectionDefaultsRepository {
  /** Read the singleton row's sections array. Returns [] if missing. */
  async get() {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('product_section_defaults')
      .select('sections, updated_at')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return Array.isArray(data?.sections) ? data.sections : [];
  }

  /** Atomically replace the singleton row's sections. */
  async replace(sections) {
    const db = createServiceClient();
    // Prefer the SQL RPC (handles both insert/update inside one txn).
    const { error: rpcError } = await db.rpc('replace_product_section_defaults', {
      p_sections: sections,
    });
    if (rpcError) {
      // Fallback for environments where the RPC isn't installed yet.
      const { data: existing } = await db
        .from('product_section_defaults')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await db
          .from('product_section_defaults')
          .update({ sections, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await db
          .from('product_section_defaults')
          .insert({ sections });
        if (error) throw error;
      }
    }
    return sections;
  }
}

export const productSectionDefaultsRepository = new ProductSectionDefaultsRepository();
