import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/middlewares/authGuard';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = user ? await isAdmin(user.id) : false;
  return NextResponse.json({ isAdmin: admin });
}
