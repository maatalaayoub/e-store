import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';

const VALID_STATUSES = ['new', 'read', 'replied', 'archived'];

/**
 * GET /api/v1/admin/contact-messages
 * Admin only — list contact messages with optional status filter.
 */
export async function GET(req) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 20)) : 50;
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;

    const supabase = createServiceClient();
    let query = supabase
      .from('contact_messages')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status && VALID_STATUSES.includes(status)) {
      query = query.eq('status', status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const { count: unreadCount, error: unreadErr } = await supabase
      .from('contact_messages')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');

    if (unreadErr) {
      console.error('[GET /api/v1/admin/contact-messages] unread count error:', unreadErr.message);
    }

    return NextResponse.json({
      success: true,
      data: data ?? [],
      count: count ?? 0,
      unread_count: unreadCount ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    if (err?.statusCode === 401 || err?.message?.toLowerCase().includes('unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[GET /api/v1/admin/contact-messages]', err?.message ?? err);
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/admin/contact-messages/:id
 * Admin only — update message status.
 */
export async function PATCH(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, {
    bucket: 'admin-contact-messages',
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    await requireAdmin();

    const { id, status } = await req.json();
    if (!id || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid id or status' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('contact_messages')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    if (err?.statusCode === 401 || err?.message?.toLowerCase().includes('unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[PATCH /api/v1/admin/contact-messages]', err?.message ?? err);
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Failed to update message' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/admin/contact-messages/:id
 * Admin only — delete a message.
 */
export async function DELETE(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, {
    bucket: 'admin-contact-messages-delete',
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Message id required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from('contact_messages').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err?.statusCode === 401 || err?.message?.toLowerCase().includes('unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[DELETE /api/v1/admin/contact-messages]', err?.message ?? err);
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Failed to delete message' },
      { status: 500 }
    );
  }
}
