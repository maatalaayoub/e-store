/**
 * Team / staff permission model.
 *
 * Roles:
 *  - `admin`  — store owner. Full access to everything, including Settings and
 *               the Team page. Owners are never restricted by `permissions`.
 *  - `staff`  — invited team member. Can only reach the admin areas listed in
 *               their `permissions` array.
 *  - `client` — regular shopper. No admin access.
 *
 * Owner-only areas (Settings, Team) are intentionally NOT grantable to staff.
 */

// Permission keys that can be granted to a staff member. Each maps to an
// admin section / nav item.
export const TEAM_PERMISSIONS = [
  'dashboard',
  'products',
  'orders',
  'customers',
  'messages',
  'notifications',
];

// Areas only the store owner (role === 'admin') may access.
export const OWNER_ONLY_AREAS = ['settings', 'team'];

/**
 * Keep only known permission keys, de-duplicated. Used on write so a client
 * can never persist an arbitrary or unknown permission string.
 */
export function normalizePermissions(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((p) => TEAM_PERMISSIONS.includes(p)))];
}

/**
 * @param {{ role?: string, permissions?: string[] } | null} access
 * @param {string} permission
 */
export function hasPermission(access, permission) {
  if (!access) return false;
  if (access.role === 'admin') return true;
  if (access.role === 'staff') {
    return Array.isArray(access.permissions) && access.permissions.includes(permission);
  }
  return false;
}

/** True if the account can reach the admin dashboard at all. */
export function canAccessAdmin(access) {
  if (!access) return false;
  if (access.role === 'admin') return true;
  return access.role === 'staff' && Array.isArray(access.permissions) && access.permissions.length > 0;
}
