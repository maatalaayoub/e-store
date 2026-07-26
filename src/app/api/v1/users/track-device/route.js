import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getRequestDeviceId, getRequestIp, getRequestUserAgent } from '@/lib/device-id';
import { logger } from '@/lib/logger';

/**
 * POST /api/v1/users/track-device
 *
 * Called by the storefront right after a successful sign-in / sign-up.
 * Records the browser's `device_id` cookie against the authenticated user
 * so admins can later ban all devices belonging to a customer with one click.
 *
 * Silently succeeds when there's no device_id cookie or no session — the
 * caller doesn't need to react to the result.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: true, tracked: false });
    }

    const deviceId = await getRequestDeviceId();
    if (!deviceId) {
      return NextResponse.json({ success: true, tracked: false });
    }

    const service = createServiceClient();

    // Reject the sign-in immediately if this device is banned so the
    // storefront can sign the user out before showing the app shell.
    const { data: banned } = await service
      .from('banned_devices')
      .select('device_id')
      .eq('device_id', deviceId)
      .maybeSingle();

    if (banned) {
      return NextResponse.json(
        { success: false, banned: true, error: 'Device is banned' },
        { status: 403 }
      );
    }

    const [userAgent, ip] = await Promise.all([
      getRequestUserAgent(),
      getRequestIp(),
    ]);

    await service
      .from('user_devices')
      .upsert(
        {
          user_id: user.id,
          device_id: deviceId,
          user_agent: userAgent,
          ip_address: ip,
          last_seen: new Date().toISOString(),
        },
        { onConflict: 'user_id,device_id' }
      );

    return NextResponse.json({ success: true, tracked: true });
  } catch (err) {
    logger.error('POST /api/v1/users/track-device', err);
    // Never let device tracking break the login flow.
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
