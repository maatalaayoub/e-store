import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';

/**
 * GET /api/v1/favorites
 * Returns the current user's favorited products.
 *
 * Pagination: `?limit=50&offset=0` \u2014 limit is clamped to MAX_LIMIT to keep
 * any single request bounded even if a user has hundreds of favorites.
 */
const FAVORITES_MAX_LIMIT = 100;
const FAVORITES_DEFAULT_LIMIT = 50;

export async function GET(req) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const rawLimit = Number(url.searchParams.get('limit'));
    const rawOffset = Number(url.searchParams.get('offset'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(FAVORITES_MAX_LIMIT, Math.floor(rawLimit))
      : FAVORITES_DEFAULT_LIMIT;
    const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

    // Only fetch the main image to avoid an N+1-style explosion when a user
    // has favorited many products with many images each. The product card
    // only ever displays the main image, so the rest is dead weight.
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        id,
        product_id,
        created_at,
        products (
          id,
          name,
          price,
          discount_price,
          discount_percentage,
          status,
          stock,
          colors,
          sizes,
          product_images!inner ( url, is_main )
        )
      `)
      .eq('user_id', user.id)
      .eq('products.product_images.is_main', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[GET /api/v1/favorites]', err?.message ?? err);
    return NextResponse.json({ success: false, error: 'Failed to fetch favorites' }, { status: 500 });
  }
}

/**
 * POST /api/v1/favorites
 * Add a product to favorites.
 * Body: { product_id }
 */
export async function POST(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, {
    bucket: 'favorites-post',
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { product_id } = await req.json();
    if (!product_id) {
      return NextResponse.json({ success: false, error: 'product_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('favorites')
      .insert({ user_id: user.id, product_id })
      .select('id')
      .single();

    if (error) {
      // Unique constraint — already favorited, treat as idempotent success.
      // Returning the same envelope shape avoids leaking schema details.
      if (error.code === '23505') {
        return NextResponse.json({ success: true, data: null });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/v1/favorites]', err?.message ?? err);
    return NextResponse.json({ success: false, error: 'Failed to add favorite' }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/favorites
 * Remove a product from favorites.
 * Body: { product_id }
 */
export async function DELETE(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, {
    bucket: 'favorites-delete',
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { product_id } = await req.json();
    if (!product_id) {
      return NextResponse.json({ success: false, error: 'product_id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', product_id);

    if (error) throw error;

    return NextResponse.json({ success: true, data: null });
  } catch (err) {
    console.error('[DELETE /api/v1/favorites]', err?.message ?? err);
    return NextResponse.json({ success: false, error: 'Failed to remove favorite' }, { status: 500 });
  }
}
