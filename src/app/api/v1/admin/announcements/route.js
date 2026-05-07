import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminUser } from '@/middlewares/authGuard';

const ALLOWED_TYPES = ['promotion', 'shipping', 'limited', 'social', 'notification', 'marquee'];
const ALLOWED_POSITIONS = ['top', 'bottom'];
const ALLOWED_BEHAVIORS = ['static', 'sticky'];
const ALLOWED_SCOPES = ['all', 'home'];
const ALLOWED_PLATFORMS = ['whatsapp', 'facebook', 'instagram', 'tiktok'];
const ALLOWED_MARQUEE_DIRECTIONS = ['left', 'right'];
const ALLOWED_MARQUEE_SCROLL_MODES = ['together', 'individual'];
const ALLOWED_CTA_DISPLAY_MODES = ['static', 'swap'];
const ALLOWED_LOCALES = ['en', 'fr', 'ar', 'dr'];

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SAFE_HREF_RE = /^(?:https?:\/\/|\/[^/]|\/$|#|mailto:|tel:)/i;

function safeHex(v, fallback) {
  if (!v) return fallback;
  const s = String(v).trim();
  return HEX_COLOR_RE.test(s) ? s : fallback;
}

function safeHref(v) {
  if (!v) return null;
  const s = String(v).trim().slice(0, 500);
  return SAFE_HREF_RE.test(s) ? s : null;
}

function safeSchedule(start, end) {
  // Drop end_at if it is on/before start_at (silently — admin form should warn).
  if (start && end) {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (Number.isFinite(s) && Number.isFinite(e) && e <= s) {
      return { start_at: start || null, end_at: null };
    }
  }
  return { start_at: start || null, end_at: end || null };
}

/**
 * Validate & shape the per-locale translations object.
 * Only `text`, `cta_text`, and `marquee_messages` are translatable.
 * Returns null when no usable translation exists (so we store NULL not {}).
 */
function safeTranslations(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = {};
  let hasAny = false;
  for (const locale of ALLOWED_LOCALES) {
    const tr = input[locale];
    if (!tr || typeof tr !== 'object') continue;
    const entry = {};
    if (typeof tr.text === 'string' && tr.text.trim()) {
      entry.text = tr.text.slice(0, 500);
    }
    if (typeof tr.cta_text === 'string' && tr.cta_text.trim()) {
      entry.cta_text = tr.cta_text.slice(0, 80);
    }
    if (Array.isArray(tr.marquee_messages)) {
      const msgs = tr.marquee_messages
        .map((m) => String(m ?? '').slice(0, 300))
        .filter((m) => m.trim().length > 0)
        .slice(0, 20);
      if (msgs.length > 0) entry.marquee_messages = msgs;
    }
    if (Object.keys(entry).length > 0) {
      out[locale] = entry;
      hasAny = true;
    }
  }
  return hasAny ? out : null;
}

/**
 * Pick a sensible base value when the admin only filled per-locale fields.
 * Returns the first non-empty value (in ALLOWED_LOCALES order).
 * For arrays, requires at least one non-empty string element.
 */
function pickBase(translations, field) {
  if (!translations) return null;
  for (const loc of ALLOWED_LOCALES) {
    const v = translations[loc]?.[field];
    if (Array.isArray(v)) {
      const meaningful = v.filter((s) => typeof s === 'string' && s.trim());
      if (meaningful.length > 0) return meaningful;
    } else if (typeof v === 'string' && v.trim()) {
      return v;
    }
  }
  return null;
}

function sanitize(a, idx = 0) {
  const sched = safeSchedule(a.start_at, a.end_at);
  const translations = safeTranslations(a.translations);

  // Base fields stay populated (legacy + fallback for clients without `translations`).
  // If admin left them empty, fall back to the first non-empty locale.
  // Exception: social type allows an empty text (info panel + buttons are the content).
  const isSocial = a.type === 'social';
  const baseText = (a.text && String(a.text).trim())
    ? String(a.text)
    : (!isSocial ? (pickBase(translations, 'text') ?? '') : '');
  const baseCta = (a.cta_text && String(a.cta_text).trim()) ? String(a.cta_text) : pickBase(translations, 'cta_text');
  const baseMarquee = Array.isArray(a.marquee_messages) && a.marquee_messages.some((m) => String(m ?? '').trim())
    ? a.marquee_messages
    : (pickBase(translations, 'marquee_messages') ?? []);

  return {
    type: ALLOWED_TYPES.includes(a.type) ? a.type : 'notification',
    text: String(baseText).slice(0, 500),
    icon_enabled: !!a.icon_enabled,
    icon: a.icon ? String(a.icon).slice(0, 32) : null,
    bg_color: safeHex(a.bg_color, '#111111'),
    text_color: safeHex(a.text_color, '#ffffff'),
    font_size: a.font_size != null ? Math.max(8, Math.min(32, Number(a.font_size) || 14)) : null,
    border_enabled: !!a.border_enabled,
    cta_text: baseCta ? String(baseCta).slice(0, 80) : null,
    cta_href: safeHref(a.cta_href),
    promo_code: a.promo_code ? String(a.promo_code).slice(0, 40) : null,
    social_whatsapp: a.social_whatsapp ? String(a.social_whatsapp).slice(0, 30) : null,
    social_facebook: a.social_facebook ? String(a.social_facebook).slice(0, 60) : null,
    social_instagram: a.social_instagram ? String(a.social_instagram).slice(0, 60) : null,
    social_tiktok: a.social_tiktok ? String(a.social_tiktok).slice(0, 60) : null,
    social_platforms: Array.isArray(a.social_platforms)
      ? [...new Set(a.social_platforms.filter((p) => ALLOWED_PLATFORMS.includes(p)))]
      : [],
    social_btn_color: safeHex(a.social_btn_color, null),
    social_show_logo: !!a.social_show_logo,
    social_logo_url: (a.social_logo_url && SAFE_HREF_RE.test(String(a.social_logo_url).trim()))
      ? String(a.social_logo_url).trim().slice(0, 500) : null,
    social_show_name: !!a.social_show_name,
    social_business_name: a.social_business_name ? String(a.social_business_name).slice(0, 80) : null,
    social_show_phone: !!a.social_show_phone,
    marquee_messages: Array.isArray(baseMarquee)
      ? baseMarquee
          .map((m) => String(m ?? '').slice(0, 300))
          .filter((m) => m.trim().length > 0)
          .slice(0, 20)
      : [],
    marquee_speed: Math.max(10, Math.min(400, Number(a.marquee_speed) || 60)),
    marquee_direction: ALLOWED_MARQUEE_DIRECTIONS.includes(a.marquee_direction) ? a.marquee_direction : 'left',
    marquee_pause_on_hover: a.marquee_pause_on_hover == null ? true : !!a.marquee_pause_on_hover,
    marquee_separator: a.marquee_separator != null ? String(a.marquee_separator).slice(0, 8) : '•',
    marquee_scroll_mode: ALLOWED_MARQUEE_SCROLL_MODES.includes(a.marquee_scroll_mode) ? a.marquee_scroll_mode : 'together',
    cta_display_mode: ALLOWED_CTA_DISPLAY_MODES.includes(a.cta_display_mode) ? a.cta_display_mode : (a.type === 'social' ? 'static' : 'swap'),
    cta_swap_seconds: Math.max(1, Math.min(30, Number(a.cta_swap_seconds) || 4)),
    position: ALLOWED_POSITIONS.includes(a.position) ? a.position : 'top',
    behavior: ALLOWED_BEHAVIORS.includes(a.behavior) ? a.behavior : 'sticky',
    scope: ALLOWED_SCOPES.includes(a.scope) ? a.scope : 'all',
    carousel_enabled: !!a.carousel_enabled,
    rotation_seconds: Math.max(2, Math.min(120, Number(a.rotation_seconds) || 5)),
    dismissible: a.dismissible == null ? true : !!a.dismissible,
    start_at: sched.start_at,
    end_at: sched.end_at,
    priority: Number.isFinite(Number(a.priority)) ? Number(a.priority) : idx,
    is_active: a.is_active == null ? true : !!a.is_active,
    translations,
  };
}

/**
 * GET /api/v1/admin/announcements
 * Returns all announcements (active or not), admin only.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    return NextResponse.json({ success: false, error: err?.message ?? 'Failed' }, { status: 500 });
  }
}

/**
 * PUT /api/v1/admin/announcements
 * Full replace: deletes all and inserts the new set.
 *
 * Uses the service client (bypasses RLS) because admin access is already
 * enforced above via getAdminUser. A `type IN (...)` filter satisfies
 * PostgREST's WHERE requirement while matching every row, since the CHECK
 * constraint guarantees type is always one of the allowed values.
 *
 * Body: { announcements: [...] }
 */
export async function PUT(request) {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const { announcements } = await request.json();
    if (!Array.isArray(announcements)) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }
    if (announcements.length > 50) {
      return NextResponse.json({ success: false, error: 'Too many announcements (max 50)' }, { status: 400 });
    }

    const rows = announcements.map((a, i) => sanitize(a, i));

    // Service client — bypasses RLS for write operations.
    const db = createServiceClient();

    // Snapshot current rows so we can restore them if the insert fails.
    const { data: snapshot } = await db.from('announcements').select('*');

    // Delete all existing rows. The `in('type', [...])` filter satisfies
    // PostgREST's WHERE requirement and matches every row due to the CHECK constraint.
    const { error: delError } = await db
      .from('announcements')
      .delete()
      .in('type', ALLOWED_TYPES);
    if (delError) throw delError;

    if (rows.length > 0) {
      const { error: insError } = await db.from('announcements').insert(rows);
      if (insError) {
        // Best-effort restore to avoid data loss on insert failure.
        if (Array.isArray(snapshot) && snapshot.length > 0) {
          await db.from('announcements').insert(snapshot).catch(() => {});
        }
        throw insError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err?.message ?? 'Failed' }, { status: 500 });
  }
}
