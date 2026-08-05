import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canAccessAdmin } from '@/middlewares/authGuard';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = user ? await canAccessAdmin(user.id) : false;
  return NextResponse.json({ isAdmin: admin });
}
