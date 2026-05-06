import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { productService } from '@/modules/products/product.service';

async function isAdmin(supabase, user) {
  if (!user) return false;
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
  return data?.role === 'admin';
}

/** POST /api/v1/products/[id]/images
 *  Body: { storagePath: string, isMain?: boolean, displayOrder?: number }
 *  The client uploads the file to Supabase Storage first, then calls this to register it.
 */
export async function POST(req, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!await isAdmin(supabase, user)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id: productId } = await params;
    const { storagePath, isMain = false, displayOrder = 0 } = await req.json();

    if (typeof storagePath !== 'string' || !storagePath.trim()) {
      return NextResponse.json({ success: false, error: 'storagePath is required' }, { status: 400 });
    }
    // Reject anything that could escape the bucket prefix or carry control
    // characters. Storage paths only ever contain ascii filenames + '/'.
    const cleaned = storagePath.trim();
    if (
      cleaned.length > 500 ||
      cleaned.startsWith('/') ||
      cleaned.includes('..') ||
      /[\x00-\x1f\\]/.test(cleaned) // eslint-disable-line no-control-regex
    ) {
      return NextResponse.json({ success: false, error: 'invalid storagePath' }, { status: 400 });
    }

    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(cleaned);

    const image = await productService.addImage(productId, {
      url: urlData.publicUrl,
      storagePath: cleaned,
      isMain,
      displayOrder,
    });

    return NextResponse.json({ success: true, data: image }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add image' },
      { status: 500 }
    );
  }
}
