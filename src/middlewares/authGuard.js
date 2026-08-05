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
 * Resolves a user's admin access context: their role and (for staff) the
 * list of permission keys they were granted. Owners (role='admin') always
 * have full access regardless of the `permissions` column.
 *
 * @returns {Promise<{ role: string|null, permissions: string[], dataFrom: string|null }>}
 */
export async function getUserAccess(userId) {
  if (!userId) return { role: null, permissions: [], dataFrom: null };
  const supabase = await createClient();
  const { data } = await supabase
    .from('users')
    .select('role, permissions, data_from')
    .eq('id', userId)
    .single();
  return {
    role: data?.role ?? null,
    permissions: Array.isArray(data?.permissions) ? data.permissions : [],
    dataFrom: data?.data_from ?? null,
  };
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

  if (profile?.role !== 'admin' && profile?.role !== 'staff') {
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

/**
 * Requires the caller to be a store owner (role='admin') OR a staff member
 * that was granted the given `permission`. Calling with no argument keeps the
 * original owner-only behaviour — used for sensitive areas (Settings, Team).
 *
 * @param {string} [permission] permission key the staff member must hold
 */
export async function requireAdmin(permission) {
  const user = await requireAuth();
  const { role, permissions } = await getUserAccess(user.id);
  if (role === 'admin') return user;
  if (role === 'staff' && permission && permissions.includes(permission)) return user;
  throw new UnauthorizedError('Admin access required');
}

/**
 * Non-throwing variant for route handlers that prefer to return a 403
 * NextResponse themselves. Pass the route's already-created supabase
 * server client so we don't open a second one.
 *
 * Returns the user if they are an owner (role='admin') or a staff member that
 * holds the given `permission`. With no `permission` argument the check is
 * owner-only. Returns null otherwise.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} [permission]
 */
export async function getAdminUser(supabase, permission) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('users')
    .select('role, permissions')
    .eq('id', user.id)
    .single();
  if (!data) return null;
  if (data.role === 'admin') return user;
  if (data.role === 'staff' && permission) {
    const perms = Array.isArray(data.permissions) ? data.permissions : [];
    if (perms.includes(permission)) return user;
  }
  return null;
}

/**
 * Returns the date lower-bound that store data should be filtered by for the
 * given user. Staff members with a `data_from` date only see records created
 * on/after that date. Owners (and staff with no date set) return null, which
 * means all-time / unrestricted access.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
export async function getStaffDataFrom(supabase, userId) {
  if (!userId) return null;
  const { data } = await supabase
    .from('users')
    .select('role, data_from')
    .eq('id', userId)
    .single();
  if (!data || data.role !== 'staff') return null;
  return data.data_from ?? null;
}

/**
 * True if the user can reach the admin dashboard at all: either an owner
 * (role='admin') or a staff member with at least one granted permission.
 * Used by the admin layout to gate the whole `/admin` section.
 */
export async function canAccessAdmin(userId) {
  const { role, permissions } = await getUserAccess(userId);
  if (role === 'admin') return true;
  return role === 'staff' && permissions.length > 0;
}
