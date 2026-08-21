import { NextResponse } from 'next/server';
import { requireAdmin } from '@/middlewares/authGuard';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';
import { testWhatsAppConnection } from '@/lib/whatsapp';
import { logger } from '@/lib/logger';

/**
 * POST /api/v1/admin/whatsapp/test
 * Verifies the saved WhatsApp Cloud API credentials against the Graph API.
 * Admin only. Uses the securely stored token — the token is never accepted
 * from, nor returned to, the client.
 */
export async function POST(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;
  const limited = await rateLimitOrReject(req, { bucket: 'whatsapp-test', limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  try {
    await requireAdmin('settings');
    const result = await testWhatsAppConnection();
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    if (err?.statusCode === 401 || err?.message?.toLowerCase().includes('unauthorized') || err?.message?.toLowerCase().includes('logged in')) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    logger.error('POST /api/v1/admin/whatsapp/test', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
