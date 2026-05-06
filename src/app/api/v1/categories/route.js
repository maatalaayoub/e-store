import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { categoryService } from '@/modules/categories/category.service';

async function isAdmin(supabase, user) {
  if (!user) return false;
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
  return data?.role === 'admin';
}

export async function GET() {
  try {
    const categories = await categoryService.getCategories();
    return NextResponse.json({ success: true, data: categories });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!await isAdmin(supabase, user)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const raw = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!raw || raw.length > 80) {
      return NextResponse.json(
        { success: false, error: 'name is required (1-80 chars)' },
        { status: 400 },
      );
    }

    const category = await categoryService.createCategory(raw);
    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create category' },
      { status: 500 }
    );
  }
}
