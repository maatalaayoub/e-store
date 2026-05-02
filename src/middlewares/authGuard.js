// Authentication Guard / Checker Middleware
import { createClient } from '@/lib/supabase/server';
import { UnauthorizedError } from '@/common/errors/AppError';

/**
 * Checks if the given user id has role = 'admin' in the public.users table.
 * Uses the session-based server client — user can always read their own row.
 */
export async function isAdmin(userId) {
  if (!userId) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role === 'admin';
}

export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError('You must be logged in to access this resource');
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  const admin = await isAdmin(user.id);
  if (!admin) {
    throw new UnauthorizedError('Admin access required');
  }
  return user;
}
