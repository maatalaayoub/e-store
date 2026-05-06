/**
 * Distributed rate limiter with in-memory fallback.
 *
 * Strategy:
 *   - If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set in the
 *     environment, use Upstash Redis sliding-window via @upstash/ratelimit.
 *   - Otherwise, fall back to a per-process in-memory sliding window.
 *
 * The Upstash packages (@upstash/ratelimit + @upstash/redis) are loaded
 * dynamically so the module is safe to import even when they aren't
 * installed yet. Install them when you provision Redis:
 *
 *     npm i @upstash/ratelimit @upstash/redis
 *
 * Usage:
 *
 *     import { rateLimit, getClientIp } from '@/lib/rate-limit';
 *     const ip = getClientIp(req);
 *     const { success } = await rateLimit(`order-lookup:${ip}`, {
 *       limit: 30,
 *       windowMs: 60_000,
 *     });
 *     if (!success) return new Response('Too many requests', { status: 429 });
 */

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

// Cache the limiter promise per (limit, windowMs) bucket so we don't
// re-create the Upstash client on every request.
const _upstashLimiters = new Map(); // key -> Promise<Ratelimit | null>

async function getUpstashLimiter(limit, windowMs) {
  const key = `${limit}:${windowMs}`;
  if (_upstashLimiters.has(key)) return _upstashLimiters.get(key);

  const promise = (async () => {
    try {
      const [{ Ratelimit }, { Redis }] = await Promise.all([
        import('@upstash/ratelimit'),
        import('@upstash/redis'),
      ]);
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
        analytics: false,
        prefix: 'rl',
      });
    } catch (err) {
      // Package not installed or runtime error — fall back silently.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[rate-limit] Upstash unavailable, using in-memory fallback:', err?.message ?? err);
      }
      return null;
    }
  })();

  _upstashLimiters.set(key, promise);
  return promise;
}

/* ── In-memory fallback (per process) ──────────────────────────────────── */

const _memHits = new Map(); // key -> number[] of timestamps

function memoryLimit(key, limit, windowMs) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const arr = (_memHits.get(key) ?? []).filter((t) => t > cutoff);
  arr.push(now);
  _memHits.set(key, arr);

  // Opportunistic GC so the map can't grow unbounded under attack.
  if (_memHits.size > 5000) {
    for (const [k, v] of _memHits) {
      const filtered = v.filter((t) => t > cutoff);
      if (filtered.length === 0) _memHits.delete(k);
      else _memHits.set(k, filtered);
    }
  }

  const remaining = Math.max(0, limit - arr.length);
  return {
    success: arr.length <= limit,
    limit,
    remaining,
    reset: (arr[0] ?? now) + windowMs,
  };
}

/**
 * Apply a rate limit check.
 *
 * @param {string} identifier  — caller-supplied key (e.g. `order-lookup:1.2.3.4`).
 * @param {{ limit: number, windowMs: number }} opts
 * @returns {Promise<{ success: boolean, limit: number, remaining: number, reset: number }>}
 */
export async function rateLimit(identifier, { limit, windowMs }) {
  if (!identifier) {
    // No identifier (e.g. no IP) → fail open but log.
    return { success: true, limit, remaining: limit, reset: Date.now() + windowMs };
  }

  if (hasUpstash) {
    const limiter = await getUpstashLimiter(limit, windowMs);
    if (limiter) {
      try {
        const r = await limiter.limit(identifier);
        return {
          success: r.success,
          limit: r.limit,
          remaining: r.remaining,
          reset: r.reset,
        };
      } catch (err) {
        // Upstash transient failure — degrade to in-memory rather than 500.
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[rate-limit] Upstash error, falling back to memory:', err?.message ?? err);
        }
      }
    }
  }

  return memoryLimit(identifier, limit, windowMs);
}

/**
 * Extract the client IP from standard proxy headers.
 * Vercel / most reverse proxies set x-forwarded-for.
 */
export function getClientIp(req) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? null;
}
