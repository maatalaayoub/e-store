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

import { createServiceClient } from '@/lib/supabase/service';

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const hasSupabase =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

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

// Periodic GC interval: every 60s scan and prune. Cheaper than per-request
// sweeps for benign traffic, and still kicks in opportunistically under
// attack (see threshold below).
let _gcStarted = false;
function startMemoryGc() {
  if (_gcStarted) return;
  _gcStarted = true;
  if (typeof setInterval !== 'function') return;
  const interval = setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000; // drop everything older than 10 min
    for (const [k, v] of _memHits) {
      const filtered = v.filter((t) => t > cutoff);
      if (filtered.length === 0) _memHits.delete(k);
      else if (filtered.length !== v.length) _memHits.set(k, filtered);
    }
  }, 60_000);
  // Don't keep the event loop alive just for GC.
  if (typeof interval?.unref === 'function') interval.unref();
}

function memoryLimit(key, limit, windowMs) {
  startMemoryGc();
  const now = Date.now();
  const cutoff = now - windowMs;
  const arr = (_memHits.get(key) ?? []).filter((t) => t > cutoff);
  arr.push(now);
  _memHits.set(key, arr);

  // Opportunistic GC at lower threshold so the map can't grow unbounded
  // under a key-spraying attack between scheduled sweeps.
  if (_memHits.size > 1000) {
    for (const [k, v] of _memHits) {
      const filtered = v.filter((t) => t > cutoff);
      if (filtered.length === 0) _memHits.delete(k);
      else if (filtered.length !== v.length) _memHits.set(k, filtered);
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

/* ── Supabase fallback (durable across serverless instances) ───────────── */

// Cache a single service client so we don't recreate it per request.
let _supabaseClient = null;
function getSupabaseClient() {
  if (!_supabaseClient) _supabaseClient = createServiceClient();
  return _supabaseClient;
}

async function supabaseLimit(key, limit, windowMs) {
  try {
    const db = getSupabaseClient();
    const { data, error } = await db.rpc('rate_limit_hit', {
      p_key: key,
      p_window_ms: Math.floor(windowMs),
      p_limit: Math.floor(limit),
    });

    if (error) throw error;

    // RPC returns an array of result rows.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('rate_limit_hit returned no row');

    return {
      success: row.success === true,
      limit: row.limit_val ?? limit,
      remaining: row.remaining ?? 0,
      reset: Number(row.reset_ms ?? Date.now() + windowMs),
    };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[rate-limit] Supabase error, falling back to memory:', err?.message ?? err);
    }
    return memoryLimit(key, limit, windowMs);
  }
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
        // Upstash transient failure — degrade to durable Supabase if available.
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[rate-limit] Upstash error, trying Supabase fallback:', err?.message ?? err);
        }
      }
    }
  }

  if (hasSupabase) {
    return supabaseLimit(identifier, limit, windowMs);
  }

  return memoryLimit(identifier, limit, windowMs);
}

/**
 * Extract the client IP from standard proxy headers.
 *
 * Priority:
 *   1. x-real-ip — set by the trusted edge proxy (Vercel, etc.).
 *   2. Rightmost x-forwarded-for entry — the hop immediately before us,
 *      much harder for a client to spoof than the leftmost value.
 *   3. x-forwarded-for leftmost entry as a last resort.
 */
export function getClientIp(req) {
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const hops = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (hops.length > 1) return hops[hops.length - 1];
    if (hops.length === 1) return hops[0];
  }

  return null;
}
