import { NextResponse } from 'next/server';

/**
 * GET /api/v1/ip-geo
 *
 * Privacy-preserving proxy for IP geolocation. The server fetches
 * get.geojs.io on behalf of the browser so the client CSP never needs to
 * permit that third-party origin. Only the ISO country code and country name
 * are returned to the client.
 */
export async function GET(req) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch('https://get.geojs.io/v1/ip/geo.json', {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: 'Geolocation unavailable' },
        { status: 502 }
      );
    }

    const raw = await res.json();
    return NextResponse.json({
      success: true,
      country_code: raw?.country_code ?? null,
      country: raw?.country ?? null,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return NextResponse.json(
        { success: false, error: 'Geolocation timeout' },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Geolocation failed' },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
