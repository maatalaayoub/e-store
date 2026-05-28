import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { productService } from '@/modules/products/product.service';

async function isAdmin(supabase, user) {
  if (!user) return false;
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
  return data?.role === 'admin';
}

/** PATCH /api/v1/products/[id]/images/[imageId]  →  set as main image */
export async function PATCH(_req, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!await isAdmin(supabase, user)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id: productId, imageId } = await params;
    const image = await productService.setMainImage(productId, imageId);
    return NextResponse.json({ success: true, data: image });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update image' },
      { status: 500 }
    );
  }
}

/** DELETE /api/v1/products/[id]/images/[imageId] */
export async function DELETE(_req, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!await isAdmin(supabase, user)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id: productId, imageId } = await params;
    await productService.deleteImage(productId, imageId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
