import { NextResponse } from 'next/server';
import { requireAuth } from '@/middlewares/authGuard';
import { withErrorHandler } from '@/middlewares/errorHandler';
import { createClient } from '@/lib/supabase/server';

const SELECT_FIELDS = 'id, full_name, email, phone_number, address, city, country';
const ALLOWED_FIELDS = ['full_name', 'phone_number', 'address', 'city', 'country'];

export const GET = withErrorHandler(async () => {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('users')
    .select(SELECT_FIELDS)
    .eq('id', user.id)
    .maybeSingle(); // returns null instead of throwing when row doesn't exist

  if (error) throw error;

  // Row may not exist yet (trigger failure or first login edge case)
  // Fall back to auth data so the page still renders
  const profile = data ?? {
    id: user.id,
    full_name: user.user_metadata?.full_name ?? '',
    email: user.email ?? '',
    phone_number: '',
    address: '',
    city: '',
    country: '',
  };

  return NextResponse.json({ success: true, data: profile });
});

export const PATCH = withErrorHandler(async (req) => {
  const user = await requireAuth();
  const supabase = await createClient();

  const body = await req.json();
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => ALLOWED_FIELDS.includes(k))
  );

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: 'No valid fields provided' },
      { status: 400 }
    );
  }

  // upsert: creates the row if it somehow doesn't exist, otherwise updates it
  const { data, error } = await supabase
    .from('users')
    .upsert(
      { id: user.id, email: user.email, ...updates },
      { onConflict: 'id' }
    )
    .select(SELECT_FIELDS)
    .single();

  if (error) throw error;

  return NextResponse.json({ success: true, data });
});

