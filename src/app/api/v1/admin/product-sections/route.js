/**
 * Admin API for the GLOBAL product-section defaults.
 *
 *   GET  /api/v1/admin/product-sections   → admin-only read of raw defaults
 *   PUT  /api/v1/admin/product-sections   → atomic full-replace
 *
 * Patterns mirror /api/v1/admin/hero-slides — same auth guard, same
 * "sanitize → snapshot → delete → insert (rollback on failure)" idea,
 * delegated to the SQL RPC `replace_product_section_defaults`.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminUser } from '@/middlewares/authGuard';
import { productSectionService } from '@/modules/product-sections/service';
import { sanitizeSections } from '@/modules/product-sections/sanitize';

export async function GET() {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    const sections = await productSectionService.getGlobalDefaults();
    return NextResponse.json({ success: true, data: sections });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Failed to load defaults' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    if (!Array.isArray(body?.sections)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload: expected { sections: [...] }' },
        { status: 400 }
      );
    }

    const sanitized = sanitizeSections(body.sections);
    await productSectionService.setGlobalDefaults(sanitized);
    return NextResponse.json({ success: true, data: sanitized });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Failed to save defaults' },
      { status: 500 }
    );
  }
}
