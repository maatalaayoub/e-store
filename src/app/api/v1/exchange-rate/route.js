import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const FX_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const FX_STALE_MS = 60 * 60 * 1000;   // warn if cache older than 1 hour

// Module-level in-memory cache (safe because exchange rates are public).
let fxCache = null; // { rates, ts }

/**
 * GET /api/v1/exchange-rate?base=MAD&target=USD
 *
 * Server-side proxy for the open.er-api.com exchange-rate endpoint.
 * Caches the result in memory so the storefront does not hammer the FX API
 * and so a failure can fall back to a previously cached rate.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const base = (searchParams.get('base') ?? 'MAD').toUpperCase();
    const target = (searchParams.get('target') ?? 'MAD').toUpperCase();

    if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(target)) {
      return NextResponse.json(
        { success: false, error: 'Invalid currency code' },
        { status: 400 }
      );
    }

    if (base === target) {
      return NextResponse.json({ success: true, rate: 1, stale: false });
    }

    // Serve from cache if still fresh.
    if (fxCache && Date.now() - fxCache.ts < FX_TTL_MS) {
      const rate = fxCache.rates?.[target] ?? fxCache.rates?.[`${base}_${target}`];
      if (rate) {
        return NextResponse.json({
          success: true,
          rate,
          stale: Date.now() - fxCache.ts > FX_STALE_MS,
        });
      }
    }

    // Fetch from provider.
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      next: { revalidate: 3600 }, // allow Next.js fetch cache as well
    });

    if (!res.ok) {
      throw new Error(`FX API returned ${res.status}`);
    }

    const data = await res.json();
    const rate = data?.rates?.[target];

    if (rate == null) {
      return NextResponse.json(
        { success: false, error: 'Currency not available' },
        { status: 400 }
      );
    }

    // Update cache.
    fxCache = { rates: data.rates, ts: Date.now() };

    return NextResponse.json({ success: true, rate, stale: false });
  } catch (err) {
    logger.error('GET /api/v1/exchange-rate', err);

    // Best-effort fallback to stale cache so the storefront keeps working.
    if (fxCache) {
      const { searchParams } = new URL(req.url);
      const target = (searchParams.get('target') ?? 'MAD').toUpperCase();
      const staleRate = fxCache.rates?.[target];
      if (staleRate) {
        return NextResponse.json({
          success: true,
          rate: staleRate,
          stale: true,
        });
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch exchange rate' },
      { status: 502 }
    );
  }
}
