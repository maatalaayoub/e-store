import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getAdminUser(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? user : null;
}

const ALLOWED_TYPES = ['promotion', 'shipping', 'limited', 'social', 'notification'];
const ALLOWED_POSITIONS = ['top', 'bottom'];
const ALLOWED_BEHAVIORS = ['static', 'sticky'];
const ALLOWED_SCOPES = ['all', 'home'];
const ALLOWED_PLATFORMS = ['whatsapp', 'facebook', 'instagram', 'tiktok'];

function sanitize(a, idx = 0) {
  return {
    type: ALLOWED_TYPES.includes(a.type) ? a.type : 'notification',
    text: String(a.text ?? '').slice(0, 500),
    icon_enabled: !!a.icon_enabled,
    icon: a.icon ? String(a.icon).slice(0, 32) : null,
    bg_color: a.bg_color ? String(a.bg_color).slice(0, 16) : '#111111',
    text_color: a.text_color ? String(a.text_color).slice(0, 16) : '#ffffff',
    font_size: a.font_size != null ? Number(a.font_size) || null : null,
    border_enabled: !!a.border_enabled,
    cta_text: a.cta_text ? String(a.cta_text).slice(0, 80) : null,
    cta_href: a.cta_href ? String(a.cta_href).slice(0, 500) : null,
    promo_code: a.promo_code ? String(a.promo_code).slice(0, 40) : null,
    social_whatsapp: a.social_whatsapp ? String(a.social_whatsapp).slice(0, 30) : null,
    social_facebook: a.social_facebook ? String(a.social_facebook).slice(0, 60) : null,
    social_instagram: a.social_instagram ? String(a.social_instagram).slice(0, 60) : null,
    social_tiktok: a.social_tiktok ? String(a.social_tiktok).slice(0, 60) : null,
    social_platforms: Array.isArray(a.social_platforms)
      ? [...new Set(a.social_platforms.filter((p) => ALLOWED_PLATFORMS.includes(p)))]
      : [],
    position: ALLOWED_POSITIONS.includes(a.position) ? a.position : 'top',
    behavior: ALLOWED_BEHAVIORS.includes(a.behavior) ? a.behavior : 'sticky',
    scope: ALLOWED_SCOPES.includes(a.scope) ? a.scope : 'all',
    carousel_enabled: !!a.carousel_enabled,
    rotation_seconds: Math.max(2, Math.min(120, Number(a.rotation_seconds) || 5)),
    dismissible: a.dismissible == null ? true : !!a.dismissible,
    start_at: a.start_at || null,
    end_at: a.end_at || null,
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
