import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { productService } from '@/modules/products/product.service';
import { getAdminUser } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';

/** PUT /api/v1/products/[id]/images/[imageId]  →  replace image file */
export async function PUT(req, { params }) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'images-put', limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id: productId, imageId } = await params;
    const body = await req.json();
    if (!body?.storagePath) {
      return NextResponse.json({ success: false, error: 'Missing storagePath' }, { status: 400 });
    }

    const publicUrl = supabase.storage.from('product-images').getPublicUrl(body.storagePath).data.publicUrl;
    const image = await productService.replaceImage(productId, imageId, { url: publicUrl, storagePath: body.storagePath });
    return NextResponse.json({ success: true, data: image });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to replace image' },
      { status: 500 }
    );
  }
}

/** PATCH /api/v1/products/[id]/images/[imageId]  →  set as main image */
export async function PATCH(req, { params }) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'images-patch', limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id: productId, imageId } = await params;
    const image = await productService.setMainImage(productId, imageId);
    return NextResponse.json({ success: true, data: image });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to update image' },
      { status: 500 }
    );
  }
}

/** DELETE /api/v1/products/[id]/images/[imageId] */
export async function DELETE(req, { params }) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'images-delete', limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id: productId, imageId } = await params;
    await productService.deleteImage(productId, imageId);
    return NextResponse.json({ success: true, data: null });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
