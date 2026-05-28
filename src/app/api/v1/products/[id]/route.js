import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { productService } from '@/modules/products/product.service';
import { productUpdateSchema } from '@/modules/products/product.validation';
import { getAdminUser } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const locale = searchParams.get('locale') ?? undefined;
    const product = await productService.getProductById(id, locale);
    if (!product) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    console.error('[api/products/:id] GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'products-put', limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const validatedData = productUpdateSchema.parse(body);
    const updated = await productService.updateProduct(id, validatedData);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Internal Error' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'products-delete', limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const db = createServiceClient();

    // Check for orders in active statuses that include this product
    const ACTIVE_STATUSES = ['pending', 'processing', 'confirmed'];
    const { data: items } = await db
      .from('order_items')
      .select('order_id')
      .eq('product_id', id);

    if (items && items.length > 0) {
      const orderIds = items.map((i) => i.order_id);
      const { data: activeOrders } = await db
        .from('orders')
        .select('id, order_number, status')
        .in('id', orderIds)
        .in('status', ACTIVE_STATUSES);

      if (activeOrders && activeOrders.length > 0) {
        return NextResponse.json(
          { success: false, error: 'active_orders', orders: activeOrders },
          { status: 409 }
        );
      }
    }

    // Soft-delete first: archiving preserves the audit trail on historical
    // order_items (which still reference this product via FK). If the
    // archived status is rejected by the schema (legacy DBs without it),
    // fall back to the previous nullify-and-delete behaviour.
    try {
      await productService.updateProduct(id, { status: 'archived' });
      return NextResponse.json({ success: true, data: { archived: true } });
    } catch {
      // Legacy fallback — nullify product_id then hard-delete.
      if (items && items.length > 0) {
        await db
          .from('order_items')
          .update({ product_id: null })
          .eq('product_id', id);
      }
      await productService.deleteProduct(id);
      return NextResponse.json({ success: true, data: { archived: false } });
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete product' }, { status: 500 });
  }
}
