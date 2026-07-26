'use client';

import { useEffect } from 'react';

/**
 * DeviceIdInit — mounts once in the locale layout and ensures the browser
 * has a stable, long-lived `device_id` cookie. This id is used by:
 *   • `POST /api/v1/users/track-device` — links the device to the signed-in user.
 *   • `authGuard.requireAuth`         — rejects requests from banned devices.
 *
 * No state, no context — just a side-effect on first paint.
 */
export default function DeviceIdInit() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const hasCookie = document.cookie
      .split(';')
      .some((c) => c.trim().startsWith('device_id='));

    if (hasCookie) return;

    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `d_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

    // 2-year expiry, SameSite=Lax so it's sent on same-site navigations & fetches.
    const twoYears = 60 * 60 * 24 * 365 * 2;
    const secure =
      typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? '; Secure'
        : '';
    document.cookie = `device_id=${id}; path=/; max-age=${twoYears}; SameSite=Lax${secure}`;
  }, []);

  return null;
}
