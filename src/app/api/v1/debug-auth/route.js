import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, authError: authError?.message });
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, email: user.email },
    profile,
    profileError: profileError?.message,
  });
}
