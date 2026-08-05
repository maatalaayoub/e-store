import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { categoryService } from '@/modules/categories/category.service';
import { getAdminUser } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';
import { logger } from '@/lib/logger';

async function requireAdminOrReject() {
  const supabase = await createClient();
  const adminUser = await getAdminUser(supabase, 'products');
  if (!adminUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }
  return null;
}

export async function PATCH(req, { params }) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'categories-patch', limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  const authRejection = await requireAdminOrReject();
  if (authRejection) return authRejection;

  try {
    const { id } = await params;
    let body = {};
    try {
      body = await req.json();
    } catch (err) {
      logger.logSwallowed('PATCH /api/v1/categories/[id]: invalid JSON body', err);
    }

    // Build a partial patch. Only keys the caller actually sent are forwarded.
    const patch = {};

    if ('name' in body) {
      const raw = typeof body.name === 'string' ? body.name.trim() : '';
      if (!raw || raw.length > 80) {
        return NextResponse.json(
          { success: false, error: 'name is required (1-80 chars)' },
          { status: 400 },
        );
      }
      patch.name = raw;
    }

    if ('image_path' in body) {
      // Explicit null → clear the image; string → set it (validated in the service).
      patch.image_path = body.image_path == null ? null : String(body.image_path);
    }

    if ('translations' in body) {
      // Whole-value replace. Pass the raw value through; the service validates.
      patch.translations = body.translations;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { success: false, error: 'nothing to update' },
        { status: 400 },
      );
    }

    try {
      const category = await categoryService.updateCategory(id, patch);
      return NextResponse.json({ success: true, data: category });
    } catch (err) {
      if (/invalid image_path|image_path must|unsupported image type|translations|Category not found/i.test(err?.message ?? '')) {
        const status = /Category not found/i.test(err.message) ? 404 : 400;
        return NextResponse.json({ success: false, error: err.message }, { status });
      }
      throw err;
    }
  } catch (err) {
    logger.error('PATCH /api/v1/categories/[id]', err);
    const msg = err?.code === '23505' ? 'A category with that name already exists' : 'Failed to update category';
    const status = err?.code === '23505' ? 409 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}

export async function DELETE(req, { params }) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'categories-delete', limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  const authRejection = await requireAdminOrReject();
  if (authRejection) return authRejection;

  try {
    const { id } = await params;
    await categoryService.deleteCategory(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('DELETE /api/v1/categories/[id]', err);
    return NextResponse.json({ success: false, error: 'Failed to delete category' }, { status: 500 });
  }
}
