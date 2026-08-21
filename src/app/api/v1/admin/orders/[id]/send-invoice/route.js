import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';
import { sendInvoiceWhatsApp } from '@/lib/whatsapp-order';
import { logger } from '@/lib/logger';

/**
 * POST /api/v1/admin/orders/[id]/send-invoice
 * Sends the customer a WhatsApp message with a secure invoice link. Admin only.
 * The invoice is delivered as a non-enumerable `/invoice/{uuid}` URL — no
 * private file is exposed publicly.
 */
export async function POST(req, { params }) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'whatsapp-invoice', limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    await requireAdmin('orders');
    const { id } = await params;
    if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });

    const db = createServiceClient();
    const { data: order, error } = await db
      .from('orders')
      .select('id, order_number, shipping_address, status')
      .eq('id', id)
      .single();
    if (error || !order) {
      return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 404 });
    }

    const result = await sendInvoiceWhatsApp({ order });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    if (err?.statusCode === 401 || err?.message?.toLowerCase().includes('unauthorized') || err?.message?.toLowerCase().includes('logged in')) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    logger.error('POST /api/v1/admin/orders/[id]/send-invoice', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
