import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/v1/debug-auth
 *
 * Development-only diagnostic endpoint. Returns the current session user and
 * profile so we can troubleshoot auth issues during local dev. Disabled in
 * production because it leaks user PII (email, role) to anyone who hits it.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

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
