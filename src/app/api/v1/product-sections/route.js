/**
 * Public read of the global product-section defaults.
 * Used by storefront preview tooling and any client-side renderer that
 * needs to render the default layout outside an SSR product page.
 */

import { NextResponse } from 'next/server';
import { productSectionService } from '@/modules/product-sections/service';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const sections = await productSectionService.getGlobalDefaults();
    return NextResponse.json({ success: true, data: sections });
  } catch (err) {
    logger.error('GET /api/v1/product-sections', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load sections' },
      { status: 500 }
    );
  }
}
