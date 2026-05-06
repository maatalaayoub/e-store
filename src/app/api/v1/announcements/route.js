import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/v1/announcements
 * Public — returns active, non-expired announcements ordered by priority (asc).
 * Schedule filtering is done in the DB query (single source of truth).
 *
 * Falls back gracefully (empty array) if the table doesn't exist.
 *
 * NOTE: We intentionally use `no-store` so admin edits are visible immediately.
 * Announcement payloads are tiny and the client component already de-dupes
 * with a module-level cache during a session.
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

    return NextResponse.json(
      { success: true, data: data ?? [] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ success: false, data: [] });
  }
}
