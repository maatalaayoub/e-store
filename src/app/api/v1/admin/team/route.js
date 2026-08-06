import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';
import { normalizePermissions } from '@/lib/permissions';
import { logger } from '@/lib/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalizes a `data_from` / `data_to` value from a request body.
 * Returns null for empty (unbounded on that side), a `YYYY-MM-DD` string when
 * valid, or `undefined` when the value is present but malformed (caller
 * should reject).
 */
function normalizeDateOnly(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (!DATE_RE.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return s;
}

function unauthorized(err) {
  return (
    err?.statusCode === 401 ||
    err?.message?.toLowerCase().includes('unauthorized') ||
    err?.message?.toLowerCase().includes('admin access') ||
    err?.message?.toLowerCase().includes('logged in')
  );
}

function memberShape(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    invited_by: row.invited_by ?? null,
    team_added_at: row.team_added_at ?? null,
    data_from: row.data_from ?? null,
    data_to: row.data_to ?? null,
    created_at: row.created_at ?? null,
  };
}

/**
 * GET /api/v1/admin/team
 * Owner only. Lists store owners (role='admin') and staff members (role='staff').
 */
export async function GET() {
  try {
    await requireAdmin();

    const service = createServiceClient();
    const { data, error } = await service
      .from('users')
      .select('id, full_name, email, role, permissions, invited_by, team_added_at, data_from, data_to, created_at')
      .in('role', ['admin', 'staff'])
      .order('role', { ascending: true })
      .order('team_added_at', { ascending: false, nullsFirst: false });
    if (error) throw error;

    const owners = [];
    const members = [];
    for (const row of data ?? []) {
      if (row.role === 'admin') owners.push(memberShape(row));
      else members.push(memberShape(row));
    }

    return NextResponse.json({ success: true, data: { owners, members } });
  } catch (err) {
    if (unauthorized(err)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    logger.error('GET /api/v1/admin/team', err);
    return NextResponse.json({ success: false, error: 'Failed to load team' }, { status: 500 });
  }
}

/**
 * POST /api/v1/admin/team
 * Owner only. Invites an existing account (by user id or email) to the team
 * and grants the given permissions. The account must already exist.
 * Body: { identifier: string, permissions: string[] }
 */
export async function POST(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'admin-team-invite', limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const owner = await requireAdmin();

    const body = await req.json().catch(() => ({}));
    const identifier = String(body.identifier ?? '').trim();
    const permissions = normalizePermissions(body.permissions);
    const dataFrom = normalizeDateOnly(body.data_from);
    const dataTo   = normalizeDateOnly(body.data_to);

    if (!identifier) {
      return NextResponse.json({ success: false, error: 'identifier_required' }, { status: 400 });
    }
    if (permissions.length === 0) {
      return NextResponse.json({ success: false, error: 'permissions_required' }, { status: 400 });
    }
    if (dataFrom === undefined) {
      return NextResponse.json({ success: false, error: 'invalid_data_from' }, { status: 400 });
    }
    if (dataTo === undefined) {
      return NextResponse.json({ success: false, error: 'invalid_data_to' }, { status: 400 });
    }
    if (dataFrom && dataTo && dataFrom > dataTo) {
      return NextResponse.json({ success: false, error: 'invalid_date_range' }, { status: 400 });
    }

    const service = createServiceClient();

    // Resolve the target account by UUID or email.
    let query = service.from('users').select('id, full_name, email, role');
    if (UUID_RE.test(identifier)) {
      query = query.eq('id', identifier);
    } else if (EMAIL_RE.test(identifier)) {
      query = query.ilike('email', identifier);
    } else {
      return NextResponse.json({ success: false, error: 'invalid_identifier' }, { status: 400 });
    }

    const { data: target, error: findErr } = await query.maybeSingle();
    if (findErr) throw findErr;
    if (!target) {
      return NextResponse.json({ success: false, error: 'account_not_found' }, { status: 404 });
    }
    if (target.id === owner.id) {
      return NextResponse.json({ success: false, error: 'cannot_invite_self' }, { status: 400 });
    }
    if (target.role === 'admin') {
      return NextResponse.json({ success: false, error: 'already_owner' }, { status: 409 });
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updErr } = await service
      .from('users')
      .update({
        role: 'staff',
        permissions,
        data_from: dataFrom,
        data_to: dataTo,
        invited_by: owner.id,
        team_added_at: nowIso,
      })
      .eq('id', target.id)
      .select('id, full_name, email, role, permissions, invited_by, team_added_at, data_from, data_to, created_at')
      .single();
    if (updErr) throw updErr;

    // Keep the audit registry in sync.
    await service
      .from('team_members')
      .upsert(
        {
          user_id: target.id,
          permissions,
          data_from: dataFrom,
          data_to: dataTo,
          status: 'active',
          invited_email: target.email,
          invited_by: owner.id,
          updated_at: nowIso,
        },
        { onConflict: 'user_id' }
      );

    return NextResponse.json({ success: true, data: memberShape(updated) });
  } catch (err) {
    if (unauthorized(err)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    logger.error('POST /api/v1/admin/team', err);
    return NextResponse.json({ success: false, error: 'Failed to invite member' }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/admin/team
 * Owner only. Updates a staff member's permissions.
 * Body: { user_id: string, permissions: string[] }
 */
export async function PATCH(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'admin-team-update', limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    await requireAdmin();

    const body = await req.json().catch(() => ({}));
    const userId = String(body.user_id ?? '').trim();
    const permissions = normalizePermissions(body.permissions);
    const dataFrom = normalizeDateOnly(body.data_from);
    const dataTo   = normalizeDateOnly(body.data_to);

    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ success: false, error: 'invalid_user' }, { status: 400 });
    }
    if (permissions.length === 0) {
      return NextResponse.json({ success: false, error: 'permissions_required' }, { status: 400 });
    }
    if (dataFrom === undefined) {
      return NextResponse.json({ success: false, error: 'invalid_data_from' }, { status: 400 });
    }
    if (dataTo === undefined) {
      return NextResponse.json({ success: false, error: 'invalid_data_to' }, { status: 400 });
    }
    if (dataFrom && dataTo && dataFrom > dataTo) {
      return NextResponse.json({ success: false, error: 'invalid_date_range' }, { status: 400 });
    }

    const service = createServiceClient();
    const { data: target, error: findErr } = await service
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!target || target.role !== 'staff') {
      return NextResponse.json({ success: false, error: 'not_a_member' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updErr } = await service
      .from('users')
      .update({ permissions, data_from: dataFrom, data_to: dataTo })
      .eq('id', userId)
      .select('id, full_name, email, role, permissions, invited_by, team_added_at, data_from, data_to, created_at')
      .single();
    if (updErr) throw updErr;

    await service
      .from('team_members')
      .update({ permissions, data_from: dataFrom, data_to: dataTo, updated_at: nowIso })
      .eq('user_id', userId);

    return NextResponse.json({ success: true, data: memberShape(updated) });
  } catch (err) {
    if (unauthorized(err)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    logger.error('PATCH /api/v1/admin/team', err);
    return NextResponse.json({ success: false, error: 'Failed to update member' }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/admin/team?user_id=...
 * Owner only. Removes a staff member from the team (reverts role to 'client').
 */
export async function DELETE(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'admin-team-remove', limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const userId = String(searchParams.get('user_id') ?? '').trim();
    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ success: false, error: 'invalid_user' }, { status: 400 });
    }

    const service = createServiceClient();
    const { data: target, error: findErr } = await service
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!target || target.role !== 'staff') {
      return NextResponse.json({ success: false, error: 'not_a_member' }, { status: 404 });
    }

    const { error: updErr } = await service
      .from('users')
      .update({ role: 'client', permissions: [], data_from: null, invited_by: null, team_added_at: null })
      .eq('id', userId);
    if (updErr) throw updErr;

    await service
      .from('team_members')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (unauthorized(err)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    logger.error('DELETE /api/v1/admin/team', err);
    return NextResponse.json({ success: false, error: 'Failed to remove member' }, { status: 500 });
  }
}
