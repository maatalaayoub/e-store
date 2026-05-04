import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { productService } from '@/modules/products/product.service';
import { productSchema } from '@/modules/products/product.validation';

async function isAdmin(supabase, user) {
  if (!user) return false;
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  return data?.role === 'admin';
}

export async function GET(req) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const admin = await isAdmin(supabase, user);

    const { searchParams } = new URL(req.url);
    const featured = searchParams.get('featured') === 'true' ? true : undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : undefined;
    const locale = searchParams.get('locale') ?? undefined;
    // Admins can filter by status (including 'all'); public only sees 'active'
    const statusParam = searchParams.get('status');
    const status = admin ? (statusParam ?? 'active') : 'active';

    const products = await productService.getProducts({ status, featured, limit, locale });
    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!await isAdmin(supabase, user)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const validatedData = productSchema.parse(body);
    const newProduct = await productService.createProduct(validatedData);
    return NextResponse.json({ success: true, data: newProduct }, { status: 201 });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Error' },
      { status: 500 }
    );
  }
}
