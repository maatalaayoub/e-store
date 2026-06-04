import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const HERO_CONFIG_KEYS = [
  'hero_type',
  'hero_single_config',
  'hero_multi_config',
  'hero_video_config',
  'hero_countdown_config',
];

/**
 * GET /api/v1/hero-slides
 * Public — returns active hero slides + hero type and type-specific config.
 * Falls back gracefully if tables don't exist yet.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch active slides and hero settings in parallel.
    const [slidesResult, settingsResult] = await Promise.all([
      supabase
        .from('hero_slides')
        .select('id, image_url, title, cta_text, href, display_order')
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('store_settings')
        .select('key, value')
        .in('key', HERO_CONFIG_KEYS),
    ]);

    if (slidesResult.error) throw slidesResult.error;

    const settingsMap = Object.fromEntries(
      (settingsResult.data ?? []).map((r) => [r.key, r.value])
    );
    const heroType = settingsMap.hero_type || 'slider';

    let heroConfig = null;
    const configKey = `hero_${heroType}_config`;
    if (heroType !== 'slider' && settingsMap[configKey]) {
      try { heroConfig = JSON.parse(settingsMap[configKey]); } catch { /* ignore */ }
    }

    return NextResponse.json({
      success: true,
      hero_type: heroType,
      config: heroConfig,
      data: slidesResult.data ?? [],
    });
  } catch {
    return NextResponse.json({ success: false, hero_type: 'slider', config: null, data: [] });
  }
}
