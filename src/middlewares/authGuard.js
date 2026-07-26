// Authentication Guard / Checker Middleware
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getRequestDeviceId } from '@/lib/device-id';
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

/**
 * Verifies an incoming request has an authenticated Supabase session AND
 * that neither the user nor their current device has been banned by an admin.
 *
 * Admins are exempt from the ban check so a self-ban never locks them out.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError('You must be logged in to access this resource');
  }

  // Ban checks — use the service role so RLS on `users`/`banned_devices`
  // doesn't hide the flag. If the caller is an admin we skip the checks so
  // an admin can never accidentally lock themselves out.
  const service = createServiceClient();
  const { data: profile } = await service
    .from('users')
    .select('role, is_banned')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    if (profile?.is_banned) {
      throw new UnauthorizedError('Your account has been suspended');
    }
    const deviceId = await getRequestDeviceId();
    if (deviceId) {
      const { data: banned } = await service
        .from('banned_devices')
        .select('device_id')
        .eq('device_id', deviceId)
        .maybeSingle();
      if (banned) {
        throw new UnauthorizedError('This device has been blocked');
      }
    }
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

/**
 * Non-throwing variant for route handlers that prefer to return a 403
 * NextResponse themselves. Pass the route's already-created supabase
 * server client so we don't open a second one.
 *
 * Returns the user if they are an admin, or null otherwise.
 */
export async function getAdminUser(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  return data?.role === 'admin' ? user : null;
}
