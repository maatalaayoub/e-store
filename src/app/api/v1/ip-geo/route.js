import { NextResponse } from 'next/server';
import { getClientIp } from '@/lib/rate-limit';

const DEFAULT_COUNTRY = 'Morocco';
const DEFAULT_COUNTRY_CODE = 'MA';

function fallbackResponse() {
  return NextResponse.json({
    success: true,
    country_code: DEFAULT_COUNTRY_CODE,
    country: DEFAULT_COUNTRY,
    fallback: true,
  });
}

function isPrivateOrLocalIpv4(ip) {
  if (/^10\./.test(ip)) return true;
  if (/^127\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  return false;
}

function normalizeClientIp(raw) {
  if (!raw) return null;
  let ip = String(raw).trim();
  if (!ip) return null;

  // IPv4-mapped IPv6
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);

  // Bracketed IPv6 from proxies: [2001:db8::1]:443
  const bracketMatch = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketMatch) ip = bracketMatch[1];

  // IPv4 with optional port
  const ipv4Port = ip.match(/^(\d+\.\d+\.\d+\.\d+):\d+$/);
  if (ipv4Port) ip = ipv4Port[1];

  // Remove IPv6 zone id if present (e.g. fe80::1%lo0)
  ip = ip.replace(/%.+$/, '');

  if (ip === '::1' || ip.toLowerCase() === 'localhost') return null;
  if (isPrivateOrLocalIpv4(ip)) return null;

  return ip;
}

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
    // Use the real client IP from trusted proxy headers.
    // If no public client IP is available, force Morocco fallback to avoid
    // incorrect server-location geolocation (commonly US).
    const trustedIp = getClientIp(req) ?? req.headers.get('cf-connecting-ip') ?? req.headers.get('x-client-ip');
    const clientIp = normalizeClientIp(trustedIp);
    if (!clientIp) {
      return fallbackResponse();
    }

    const res = await fetch(`https://get.geojs.io/v1/ip/geo/${encodeURIComponent(clientIp)}.json`, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      return fallbackResponse();
    }

    const raw = await res.json();
    const code = String(raw?.country_code ?? '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      return fallbackResponse();
    }

    return NextResponse.json({
      success: true,
      country_code: code,
      country: raw?.country ?? DEFAULT_COUNTRY,
    });
  } catch (err) {
    return fallbackResponse();
  } finally {
    clearTimeout(timeout);
  }
}
