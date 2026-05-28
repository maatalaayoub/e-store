import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { productService } from '@/modules/products/product.service';
import { productSchema } from '@/modules/products/product.validation';
import { getAdminUser } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';

export async function GET(req) {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);

    const { searchParams } = new URL(req.url);
    const featured = searchParams.get('featured') === 'true' ? true : undefined;
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    // Clamp limit so a public caller can't request the whole catalogue.
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 20)) : undefined;
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10) || 0) : undefined;
    const locale = searchParams.get('locale') ?? undefined;
    // Admins can filter by status (including 'all'); public only sees 'active'
    const statusParam = searchParams.get('status');
    const status = adminUser ? (statusParam ?? 'active') : 'active';

    const products = await productService.getProducts({ status, featured, limit, offset, locale });
    return NextResponse.json({ success: true, data: products }, {
      headers: adminUser ? undefined : { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('[api/products] GET failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'products-post', limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
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
      { success: false, error: 'Internal Error' },
      { status: 500 }
    );
  }
}
