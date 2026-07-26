import { NextResponse } from 'next/server';
import { getDisplaySettings } from '@/lib/display-settings';

/**
 * GET /api/v1/display-settings
 * Returns public display settings used by shop-facing components.
 * No authentication required — only non-sensitive display preferences.
 *
 * The keys/defaults live in `src/lib/display-settings.js` so the server-side
 * layout can hydrate a provider with the same values (avoiding first-paint
 * flicker in the shop header).
 */
export async function GET() {
  const data = await getDisplaySettings();
  return NextResponse.json({ success: true, data }, {
    // Short cache so admin toggles propagate fast, but the SWR window
    // keeps the storefront snappy under burst load.
    headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=3600' },
  });
}
