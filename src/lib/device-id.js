/**
 * Server-side helpers for reading the storefront's device identity.
 *
 * The client sets a long-lived cookie called `device_id` (see
 * `DeviceIdInit` in `src/components/providers/DeviceIdInit.js`). Admins
 * can ban individual devices — the middleware/authGuard consults these
 * helpers to reject requests coming from banned devices.
 */

import { cookies, headers } from 'next/headers';

export const DEVICE_ID_COOKIE = 'device_id';
export const DEVICE_ID_MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 years

/**
 * Returns the device_id cookie for the current request, or null if none.
 * Must be called from a server component / route handler.
 */
export async function getRequestDeviceId() {
  const jar = await cookies();
  return jar.get(DEVICE_ID_COOKIE)?.value ?? null;
}

/**
 * Returns a best-effort IP address from standard forwarding headers.
 */
export async function getRequestIp() {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return (
    h.get('x-real-ip') ??
    h.get('cf-connecting-ip') ??
    h.get('true-client-ip') ??
    null
  );
}

export async function getRequestUserAgent() {
  const h = await headers();
  return h.get('user-agent') ?? null;
}
