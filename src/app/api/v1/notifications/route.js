import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminUser } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';
import { logger } from '@/lib/logger';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

function parsePagination(searchParams) {
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);
  return { limit, offset };
}

export async function GET(req) {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const { limit, offset } = parsePagination(searchParams);
    const unreadOnly = searchParams.get('unread') === 'true';
    const typeFilter = searchParams.get('type');

    let query = supabase
      .from('admin_notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) query = query.eq('read', false);
    if (typeFilter) query = query.eq('type', typeFilter);

    const { data, error, count } = await query;
    if (error) throw error;

    const { count: unreadCount, error: countErr } = await supabase
      .from('admin_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false);

    if (countErr) console.error('[GET /api/v1/notifications] unread count error:', countErr.message);

    return NextResponse.json({
      success: true,
      data: data ?? [],
      unread_count: unreadCount ?? 0,
      pagination: {
        limit,
        offset,
        total: count ?? 0,
        hasMore: (count ?? 0) > offset + limit,
      },
    });
  } catch (err) {
    logger.error('GET /api/v1/notifications', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function PATCH(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'notifications-patch', limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { id, ids, read = true, all = false } = body;

    let query = supabase
      .from('admin_notifications')
      .update({ read, updated_at: new Date().toISOString() });

    if (all) {
      query = query.not('id', 'is', null);
    } else if (Array.isArray(ids) && ids.length > 0) {
      query = query.in('id', ids);
    } else if (id) {
      query = query.eq('id', id);
    } else {
      return NextResponse.json({ success: false, error: 'Missing id, ids or all' }, { status: 400 });
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('PATCH /api/v1/notifications', err);
    return NextResponse.json({ success: false, error: 'Failed to update notifications' }, { status: 500 });
  }
}

export async function DELETE(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'notifications-delete', limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { ids, all_read = false, all = false } = body;

    let query = supabase.from('admin_notifications').delete();

    if (all) {
      // Delete all rows.
    } else if (all_read) {
      query = query.eq('read', true);
    } else if (Array.isArray(ids) && ids.length > 0) {
      query = query.in('id', ids);
    } else {
      return NextResponse.json({ success: false, error: 'Missing ids, all_read or all' }, { status: 400 });
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('DELETE /api/v1/notifications', err);
    return NextResponse.json({ success: false, error: 'Failed to delete notifications' }, { status: 500 });
  }
}
