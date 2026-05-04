import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getAdminUser(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? user : null;
}

/**
 * GET /api/v1/admin/hero-slides
 * Returns all hero slides (including inactive), admin only.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const { data, error } = await supabase
      .from('hero_slides')
      .select('*')
      .order('display_order');

    if (error) throw error;
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    return NextResponse.json({ success: false, error: err?.message ?? 'Failed' }, { status: 500 });
  }
}

/**
 * PUT /api/v1/admin/hero-slides
 * Full replace: deletes all existing slides and inserts the new set.
 * Body: { slides: [{ image_url, title, cta_text, href, is_active }] }
 */
export async function PUT(request) {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const { slides } = await request.json();
    if (!Array.isArray(slides)) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    // Delete all existing slides
    await supabase.from('hero_slides').delete().not('id', 'is', null);

    if (slides.length > 0) {
      const { error } = await supabase.from('hero_slides').insert(
        slides.map((s, i) => ({
          image_url: s.image_url,
          title: s.title,
          cta_text: s.cta_text,
          href: s.href,
          display_order: i,
          is_active: s.is_active ?? true,
        }))
      );
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err?.message ?? 'Failed' }, { status: 500 });
  }
}
