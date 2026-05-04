import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { productService } from '@/modules/products/product.service';
import { productUpdateSchema } from '@/modules/products/product.validation';

async function isAdmin(supabase, user) {
  if (!user) return false;
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
  return data?.role === 'admin';
}

export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    const product = await productService.getProductById(id);
    if (!product) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: product });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!await isAdmin(supabase, user)) {
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
    return NextResponse.json({ success: false, error: error.message || 'Internal Error' }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!await isAdmin(supabase, user)) {
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

    // Nullify product_id on historical order_items (shipped/delivered/cancelled)
    // so the FK constraint doesn't block the delete.
    if (items && items.length > 0) {
      await db
        .from('order_items')
        .update({ product_id: null })
        .eq('product_id', id);
    }

    await productService.deleteProduct(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete product' }, { status: 500 });
  }
}
