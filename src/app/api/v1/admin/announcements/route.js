import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getAdminUser(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? user : null;
}

const ALLOWED_TYPES = ['promotion', 'shipping', 'limited', 'social', 'notification', 'marquee'];
const ALLOWED_POSITIONS = ['top', 'bottom'];
const ALLOWED_BEHAVIORS = ['static', 'sticky'];
const ALLOWED_SCOPES = ['all', 'home'];
const ALLOWED_PLATFORMS = ['whatsapp', 'facebook', 'instagram', 'tiktok'];
const ALLOWED_MARQUEE_DIRECTIONS = ['left', 'right'];
const ALLOWED_MARQUEE_SCROLL_MODES = ['together', 'individual'];
const ALLOWED_CTA_DISPLAY_MODES = ['static', 'swap'];

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

function sanitize(a, idx = 0) {
  const sched = safeSchedule(a.start_at, a.end_at);
  return {
    type: ALLOWED_TYPES.includes(a.type) ? a.type : 'notification',
    text: String(a.text ?? '').slice(0, 500),
    icon_enabled: !!a.icon_enabled,
    icon: a.icon ? String(a.icon).slice(0, 32) : null,
    bg_color: safeHex(a.bg_color, '#111111'),
    text_color: safeHex(a.text_color, '#ffffff'),
    font_size: a.font_size != null ? Math.max(8, Math.min(32, Number(a.font_size) || 14)) : null,
    border_enabled: !!a.border_enabled,
    cta_text: a.cta_text ? String(a.cta_text).slice(0, 80) : null,
    cta_href: safeHref(a.cta_href),
    promo_code: a.promo_code ? String(a.promo_code).slice(0, 40) : null,
    social_whatsapp: a.social_whatsapp ? String(a.social_whatsapp).slice(0, 30) : null,
    social_facebook: a.social_facebook ? String(a.social_facebook).slice(0, 60) : null,
    social_instagram: a.social_instagram ? String(a.social_instagram).slice(0, 60) : null,
    social_tiktok: a.social_tiktok ? String(a.social_tiktok).slice(0, 60) : null,
    social_platforms: Array.isArray(a.social_platforms)
      ? [...new Set(a.social_platforms.filter((p) => ALLOWED_PLATFORMS.includes(p)))]
      : [],
    marquee_messages: Array.isArray(a.marquee_messages)
      ? a.marquee_messages
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
 * Full replace: deletes all and inserts the new set. Mirrors hero-slides API.
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

    await supabase.from('announcements').delete().not('id', 'is', null);

    if (announcements.length > 0) {
      const rows = announcements.map((a, i) => sanitize(a, i));
      const { error } = await supabase.from('announcements').insert(rows);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err?.message ?? 'Failed' }, { status: 500 });
  }
}
