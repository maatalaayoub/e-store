import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/v1/hero-slides
 * Public — returns active hero slides ordered by display_order.
 * Falls back gracefully if the table doesn't exist yet.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('hero_slides')
      .select('id, image_url, title, cta_text, href, display_order')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch {
    return NextResponse.json({ success: false, data: [] });
  }
}
