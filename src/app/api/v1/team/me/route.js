import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserAccess } from '@/middlewares/authGuard';

/**
 * GET /api/v1/team/me
 * Returns the signed-in user's admin access context so the AdminShell can
 * decide which navigation items to render. Owners (role='admin') get every
 * permission implicitly; staff get only what was granted to them.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: true, role: null, permissions: [], isOwner: false });
  }
  const { role, permissions } = await getUserAccess(user.id);
  return NextResponse.json({
    success: true,
    role,
    permissions,
    isOwner: role === 'admin',
  });
}
