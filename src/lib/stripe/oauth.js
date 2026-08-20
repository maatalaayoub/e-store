import crypto from 'node:crypto';
import { env } from '@/config/env';
import {
  getStripeAppConfig,
  getStripeRedirectUri,
  normalizeEnvironment,
} from '@/lib/stripe/config';

/**
 * Signed, short-lived state for the Stripe Connect OAuth flow.
 *
 * The state is an HMAC-signed, tamper-proof token carrying the chosen
 * environment, a single-use nonce, and the admin's return path. Verifying the
 * signature on the callback defends the flow against CSRF and parameter
 * tampering; the nonce (also stored server-side) prevents replay.
 */

function signingKey() {
  const secret = env.STRIPE_TOKEN_ENCRYPTION_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('No signing secret available for Stripe OAuth state');
  return crypto.createHash('sha256').update(`stripe-oauth:${secret}`).digest();
}

/** Sign a payload into a `body.signature` state token (adds a timestamp). */
export function signState(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, ts: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/**
 * Verify a state token and return its payload, or null when the signature is
 * invalid, the token is malformed, or it has expired.
 */
export function verifyState(token, maxAgeMs = 10 * 60 * 1000) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload?.ts || Date.now() - payload.ts > maxAgeMs) return null;
  return payload;
}

/**
 * Builds the Stripe Connect OAuth authorize URL for the given environment.
 * The platform `client_id` selects test vs live mode on Stripe's side.
 */
export function buildAuthorizeUrl({ environment, state }) {
  const envName = normalizeEnvironment(environment);
  const cfg = getStripeAppConfig(envName);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    scope: 'read_write',
    redirect_uri: getStripeRedirectUri(),
    state,
  });
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

/**
 * Sanitizes a caller-supplied return path so we only ever redirect to a
 * same-origin path. Rejects absolute URLs and protocol-relative paths.
 */
export function sanitizeReturnTo(value, fallback = '/admin/settings?tab=payments') {
  if (!value || typeof value !== 'string') return fallback;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return fallback;
  if (decoded.includes('\\') || /[\r\n]/.test(decoded)) return fallback;
  return decoded;
}
