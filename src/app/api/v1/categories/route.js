import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { categoryService } from '@/modules/categories/category.service';
import { getAdminUser } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';
import { logger } from '@/lib/logger';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const withCounts = searchParams.get('withCounts') === '1';
    if (withCounts) {
      // Product counts are admin-only management data and must never be cached.
      const supabase = await createClient();
      const adminUser = await getAdminUser(supabase, 'products');
      if (!adminUser) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }
      const categories = await categoryService.getCategoriesWithCounts();
      return NextResponse.json({ success: true, data: categories }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    const categories = await categoryService.getCategories();
    return NextResponse.json({ success: true, data: categories }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
    });
  } catch (err) {
    logger.error('GET /api/v1/categories', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'categories-post', limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase, 'products');
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    let body = {};
    try {
      body = await req.json();
    } catch (err) {
      logger.logSwallowed('POST /api/v1/categories: invalid JSON body', err);
    }
    const raw = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!raw || raw.length > 80) {
      return NextResponse.json(
        { success: false, error: 'name is required (1-80 chars)' },
        { status: 400 },
      );
    }

    try {
      const category = await categoryService.createCategory({
        name: raw,
        image_path: typeof body?.image_path === 'string' ? body.image_path : null,
        translations: body?.translations ?? null,
      });
      return NextResponse.json({ success: true, data: category }, { status: 201 });
    } catch (err) {
      // Surface validation errors from sanitizeImagePath / sanitizeTranslations as 400.
      if (/invalid image_path|image_path must|unsupported image type|translations/i.test(err?.message ?? '')) {
        return NextResponse.json({ success: false, error: err.message }, { status: 400 });
      }
      throw err;
    }
  } catch (err) {
    logger.error('POST /api/v1/categories', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create category',
        ...(process.env.NODE_ENV !== 'production'
          ? { debug: { message: err?.message, code: err?.code, details: err?.details, hint: err?.hint } }
          : {}),
      },
      { status: 500 }
    );
  }
}
