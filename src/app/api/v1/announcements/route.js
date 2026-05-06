import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/v1/announcements
 * Public — returns active, non-expired announcements ordered by priority (asc).
 * Schedule filtering uses the DB (start_at / end_at) for performance, then
 * the client re-filters defensively (covers cached responses).
 *
 * Falls back gracefully (empty array) if the table doesn't exist.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .or(`start_at.is.null,start_at.lte.${nowIso}`)
      .or(`end_at.is.null,end_at.gte.${nowIso}`)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Cache for 30 seconds at the edge; clients also use module-level cache.
    return NextResponse.json(
      { success: true, data: data ?? [] },
      { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60' } },
    );
  } catch {
    return NextResponse.json({ success: false, data: [] });
  }
}
