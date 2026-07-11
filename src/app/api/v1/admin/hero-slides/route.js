import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminUser } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';
import { logger } from '@/lib/logger';

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

function sanitizeTranslations(t) {
  if (!t || typeof t !== 'object') return {};
  const result = {};
  for (const [lang, val] of Object.entries(t)) {
    if (typeof lang !== 'string' || lang.length > 10) continue;
    if (val && typeof val === 'object') {
      result[lang] = {
        title:    safeStr(val.title,    200),
        cta_text: safeStr(val.cta_text,  80),
      };
    }
  }
  return result;
}

function firstTranslationString(translations, field, max) {
  if (!translations || typeof translations !== 'object') return null;
  // Prefer English, then any locale with a non-empty value.
  const candidates = [translations.en, translations.fr, translations.ar, translations.dr];
  for (const bucket of candidates) {
    const v = safeStr(bucket?.[field], max);
    if (v) return v;
  }
  for (const bucket of Object.values(translations)) {
    const v = safeStr(bucket?.[field], max);
    if (v) return v;
  }
  return null;
}

function sanitizeSlide(s, idx) {
  const translations = sanitizeTranslations(s?.translations);
  return {
    image_url:    safeImageUrl(s?.image_url),
    // The admin UI stores text in translations; fall back from there when
    // the legacy flat fields are absent so the NOT NULL column never gets null.
    title:        safeStr(s?.title, 200) ?? firstTranslationString(translations, 'title', 200) ?? '',
    cta_text:     safeStr(s?.cta_text, 80) ?? firstTranslationString(translations, 'cta_text', 80) ?? '',
    href:         safeHref(s?.href),
    display_order: idx,
    is_active:    s?.is_active !== false,
    translations,
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
    logger.error('GET /api/v1/admin/hero-slides', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch hero slides' }, { status: 500 });
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
  const originRejection = assertSameOrigin(request);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(request, { bucket: 'admin-hero-slides', limit: 10, windowMs: 60_000 });
  if (limited) return limited;
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
      let { error: insError } = await db.from('hero_slides').insert(sanitized);

      // If the translations column doesn't exist yet (migration not run),
      // retry without it so saving slides is never blocked.
      if (insError && (
        insError.code === 'PGRST204' ||
        insError.code === '42703' ||
        insError.message?.toLowerCase().includes('translations')
      )) {
        const stripped = sanitized.map(({ translations: _t, ...rest }) => rest);
        const { error: retryErr } = await db.from('hero_slides').insert(stripped);
        insError = retryErr;
      }

      if (insError) {
        // Best-effort rollback — log any error here but do not fail the request.
        if (Array.isArray(snapshot) && snapshot.length > 0) {
          try {
            await db.from('hero_slides').insert(snapshot);
          } catch (restoreErr) {
            logger.logSwallowed('PUT /api/v1/admin/hero-slides: rollback failed', restoreErr);
          }
        }
        throw insError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('PUT /api/v1/admin/hero-slides', err);
    return NextResponse.json({ success: false, error: 'Failed to save hero slides' }, { status: 500 });
  }
}
