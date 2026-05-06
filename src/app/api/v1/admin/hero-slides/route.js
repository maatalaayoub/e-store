import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminUser } from '@/middlewares/authGuard';

/**
 * Allowed schemes for hero hrefs and image URLs.
 * `//` (protocol-relative) is intentionally rejected to prevent open redirects.
 */
const SAFE_HREF_RE = /^(?:https?:\/\/|\/[^/]|\/$|#|mailto:|tel:)/i;
const SAFE_IMAGE_URL_RE = /^https?:\/\/[^\s]+$/i;

function safeStr(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function safeHref(v) {
  const s = safeStr(v, 500);
  if (!s) return null;
  return SAFE_HREF_RE.test(s) ? s : null;
}

function safeImageUrl(v) {
  const s = safeStr(v, 1000);
  if (!s) return null;
  // Accept absolute http(s) URLs and root-relative paths only.
  if (SAFE_IMAGE_URL_RE.test(s)) return s;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  return null;
}

function sanitizeSlide(s, idx) {
  return {
    image_url: safeImageUrl(s?.image_url),
    title: safeStr(s?.title, 200),
    cta_text: safeStr(s?.cta_text, 80),
    href: safeHref(s?.href),
    display_order: idx,
    is_active: s?.is_active !== false,
  };
}

/**
 * GET /api/v1/admin/hero-slides
 * Returns all hero slides (including inactive), admin only.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const { data, error } = await supabase
      .from('hero_slides')
      .select('*')
      .order('display_order');

    if (error) throw error;
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    return NextResponse.json({ success: false, error: err?.message ?? 'Failed' }, { status: 500 });
  }
}

/**
 * PUT /api/v1/admin/hero-slides
 * Full replace: deletes all existing slides and inserts the new set.
 *
 * Uses the service client (bypasses RLS) — admin access verified above.
 * `neq('id', nil-uuid)` satisfies PostgREST's WHERE requirement and matches
 * every real row since uuid_generate_v4() never produces the nil UUID.
 *
 * Body: { slides: [{ image_url, title, cta_text, href, is_active }] }
 */
export async function PUT(request) {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const { slides } = await request.json();
    if (!Array.isArray(slides)) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }
    if (slides.length > 20) {
      return NextResponse.json({ success: false, error: 'Too many slides (max 20)' }, { status: 400 });
    }

    // Sanitize first so we can fail fast on a bad payload before touching the
    // database. Drop any slide that has no image — it's not renderable.
    const sanitized = slides
      .map((s, i) => sanitizeSlide(s, i))
      .filter((s) => s.image_url);

    // Service client — bypasses RLS for write operations.
    const db = createServiceClient();

    // Snapshot current rows for best-effort restore on insert failure.
    const { data: snapshot } = await db.from('hero_slides').select('*');

    // Delete all existing slides. neq(nil-uuid) satisfies PostgREST's
    // WHERE requirement and matches every auto-generated UUID row.
    const { error: delError } = await db
      .from('hero_slides')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (delError) throw delError;

    if (sanitized.length > 0) {
      const { error: insError } = await db.from('hero_slides').insert(sanitized);
      if (insError) {
        if (Array.isArray(snapshot) && snapshot.length > 0) {
          await db.from('hero_slides').insert(snapshot).catch(() => {});
        }
        throw insError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err?.message ?? 'Failed' }, { status: 500 });
  }
}
