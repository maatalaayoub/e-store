import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { assertSameOrigin, rateLimitOrReject } from '@/lib/request-guard';

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 40;
const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;

function safeStr(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/v1/contact
 * Public endpoint for visitors to submit a contact message.
 * Rate-limited and origin-checked to reduce spam.
 */
export async function POST(req) {
  const originRejection = assertSameOrigin(req);
  if (originRejection) return originRejection;

  const limited = await rateLimitOrReject(req, {
    bucket: 'contact-submit',
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = await req.json();

    const name = safeStr(body?.name, MAX_NAME_LENGTH);
    const email = safeStr(body?.email, MAX_EMAIL_LENGTH)?.toLowerCase();
    const phone = safeStr(body?.phone, MAX_PHONE_LENGTH);
    const subject = safeStr(body?.subject, MAX_SUBJECT_LENGTH);
    const message = safeStr(body?.message, MAX_MESSAGE_LENGTH);

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: 'Name, email and message are required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from('contact_messages').insert({
      name,
      email,
      phone,
      subject,
      message,
      status: 'new',
    });

    if (error) throw error;

    return NextResponse.json(
      { success: true, message: 'Message sent' },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/v1/contact]', err?.message ?? err);
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Failed to send message' },
      { status: 500 }
    );
  }
}
