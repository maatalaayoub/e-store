import crypto from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

/**
 * Server-only WhatsApp Business Cloud API helper.
 *
 * Phase 2 scope: secure credential storage (AES-256-GCM at rest), a cached
 * config loader, and a lightweight connection test. Message/template sending
 * is added in Phase 3 on top of the same config + crypto.
 *
 * The access token never leaves the server. It is encrypted before being
 * written to `store_settings` and only decrypted inside server code that needs
 * to call the Graph API.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ENC_PREFIX = 'enc:';

/** Graph API version used for all WhatsApp Cloud API calls. */
export const GRAPH_VERSION = 'v21.0';

/** Derive a stable 32-byte key from a deployer secret. */
function getKey() {
  const secret = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('No encryption secret available for WhatsApp token');
  return crypto.createHash('sha256').update(`whatsapp:${secret}`).digest();
}

/**
 * Encrypt a plaintext token. Returns a compact `enc:base64(iv|tag|ciphertext)`
 * envelope, or '' for nullish/empty input.
 */
export function encryptWhatsAppToken(plaintext) {
  if (plaintext == null || plaintext === '') return '';
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a value produced by {@link encryptWhatsAppToken}. Returns '' for
 * nullish input. Values without the `enc:` prefix are treated as legacy
 * plaintext and returned as-is.
 */
export function decryptWhatsAppToken(envelope) {
  if (!envelope) return '';
  const value = String(envelope);
  if (!value.startsWith(ENC_PREFIX)) return value;
  try {
    const raw = Buffer.from(value.slice(ENC_PREFIX.length), 'base64');
    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const data = raw.subarray(IV_BYTES + TAG_BYTES);
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (err) {
    logger.error('decryptWhatsAppToken: failed to decrypt', err);
    return '';
  }
}

// ── Cached config loader ────────────────────────────────────────────────────

const CONFIG_TTL_MS = 5 * 60 * 1000; // 5 minutes
let _configCache = null; // { value, ts }

/** Drop the in-memory config cache after an admin updates settings. */
export function invalidateWhatsAppConfig() {
  _configCache = null;
}

const CONFIG_KEYS = [
  'whatsapp_access_token',
  'whatsapp_phone_number_id',
  'whatsapp_business_account_id',
  'whatsapp_notifications_enabled',
];

/**
 * Load WhatsApp Cloud API credentials from `store_settings`. The access token
 * is decrypted here. Cached for {@link CONFIG_TTL_MS}.
 *
 * @returns {Promise<{accessToken: string, phoneNumberId: string, businessAccountId: string, enabled: boolean}>}
 */
export async function getWhatsAppConfig() {
  if (_configCache && Date.now() - _configCache.ts < CONFIG_TTL_MS) {
    return _configCache.value;
  }
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('store_settings')
    .select('key, value')
    .in('key', CONFIG_KEYS);

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? '']));
  const value = {
    accessToken: decryptWhatsAppToken(map.whatsapp_access_token ?? ''),
    phoneNumberId: map.whatsapp_phone_number_id ?? '',
    businessAccountId: map.whatsapp_business_account_id ?? '',
    enabled: (map.whatsapp_notifications_enabled ?? 'false') === 'true',
  };
  _configCache = { value, ts: Date.now() };
  return value;
}

/** True when the minimum credentials for sending are present. */
export function isWhatsAppConfigured(config) {
  return Boolean(config?.accessToken && config?.phoneNumberId);
}

// ── Phone normalization ─────────────────────────────────────────────────────

/**
 * Normalize a phone number to the digits-only international form the WhatsApp
 * Cloud API expects (no `+`, spaces, or separators). Returns null when the
 * input can't be turned into a plausible international number.
 *
 * - `00` international prefix is stripped.
 * - A leading `0` (national trunk prefix) is replaced with `defaultCountryCode`
 *   when one is supplied (e.g. Morocco: `0600000000` → `212600000000`).
 *
 * @param {string} raw
 * @param {{ defaultCountryCode?: string }} [opts]
 * @returns {string|null}
 */
export function normalizeWhatsAppPhone(raw, { defaultCountryCode = '' } = {}) {
  if (raw == null) return null;
  let s = String(raw).trim();
  const hadPlus = s.startsWith('+');
  let digits = s.replace(/\D/g, '');
  if (!digits) return null;

  const cc = String(defaultCountryCode ?? '').replace(/\D/g, '');

  if (!hadPlus) {
    if (digits.startsWith('00')) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0') && cc) {
      digits = cc + digits.slice(1);
    }
  }

  // E.164 allows up to 15 digits; require at least a country code + subscriber.
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

// ── Sending ─────────────────────────────────────────────────────────────────

const SEND_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3; // 1 try + 2 retries for transient failures
const RETRY_BASE_DELAY_MS = 400;
const WHATSAPP_TEXT_MAX = 4096; // Cloud API body limit

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Meta error codes that are worth retrying (transient / rate limited). */
const RETRYABLE_CODES = new Set([
  131_016, // service unavailable
  131_048, // spam rate limit hit
  130_429, // rate limit hit
  368,     // temporarily blocked
  1,       // unknown / transient API error
]);

function isRetryable({ error, code, status }) {
  if (error === 'timeout' || error === 'network_error') return true;
  if (typeof status === 'number' && status >= 500) return true;
  if (code != null && RETRYABLE_CODES.has(Number(code))) return true;
  return false;
}

/**
 * Low-level POST to the Cloud API `/messages` endpoint. Handles auth, timeout
 * and structured error parsing. Never throws — returns a result object.
 *
 * @returns {Promise<{ok: boolean, messageId?: string|null, error?: string, code?: number|null, status?: number}>}
 */
async function postMessage(config, body) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(config.phoneNumberId)}/messages`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        error: json?.error?.message || `http_${res.status}`,
        code: json?.error?.code ?? null,
        status: res.status,
      };
    }
    return { ok: true, messageId: json?.messages?.[0]?.id ?? null };
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, error: 'timeout' };
    return { ok: false, error: 'network_error' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send a message payload (already shaped for the Cloud API, minus the envelope
 * fields), applying credential loading, the global enable check, and retry with
 * backoff for transient errors. Never throws.
 *
 * @param {string} to  Recipient phone (any format; normalized here).
 * @param {object} message  e.g. { type: 'text', text: {...} } or { type: 'template', template: {...} }
 * @param {{ defaultCountryCode?: string, requireEnabled?: boolean }} [opts]
 */
async function dispatch(to, message, { defaultCountryCode = '', requireEnabled = true } = {}) {
  try {
    const config = await getWhatsAppConfig();
    if (!isWhatsAppConfigured(config)) return { ok: false, error: 'not_configured' };
    if (requireEnabled && !config.enabled) return { ok: false, error: 'disabled' };

    const phone = normalizeWhatsAppPhone(to, { defaultCountryCode });
    if (!phone) return { ok: false, error: 'invalid_phone' };

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      ...message,
    };

    let result;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      result = await postMessage(config, body);
      if (result.ok || !isRetryable(result) || attempt === MAX_ATTEMPTS) break;
      await wait(RETRY_BASE_DELAY_MS * attempt);
    }

    if (!result.ok) {
      logger.logSwallowed('whatsapp dispatch failed', new Error(`${message.type}: ${result.error} (code ${result.code ?? '-'})`));
    }
    return result;
  } catch (err) {
    logger.logSwallowed('whatsapp dispatch', err);
    return { ok: false, error: 'unexpected_error' };
  }
}

/**
 * Send a free-form text message. NOTE: outside the 24-hour customer service
 * window Meta only permits pre-approved templates — use
 * {@link sendWhatsAppTemplate} for business-initiated order notifications.
 * Never throws.
 */
export async function sendWhatsAppText(to, text, { defaultCountryCode = '', previewUrl = false, requireEnabled = true } = {}) {
  const safe = String(text ?? '').slice(0, WHATSAPP_TEXT_MAX);
  return dispatch(
    to,
    { type: 'text', text: { preview_url: Boolean(previewUrl), body: safe } },
    { defaultCountryCode, requireEnabled },
  );
}

/**
 * Build the `components` array for a template that has positional `{{n}}` body
 * variables. Pass values in order.
 */
export function buildTemplateBody(variables = []) {
  if (!Array.isArray(variables) || variables.length === 0) return [];
  return [
    {
      type: 'body',
      parameters: variables.map((v) => ({ type: 'text', text: String(v ?? '') })),
    },
  ];
}

/**
 * Send a pre-approved template message. This is the primary path for
 * business-initiated order notifications. Never throws.
 *
 * @param {string} to  Recipient phone (any format; normalized here).
 * @param {{ name: string, languageCode?: string, components?: object[] }} template
 * @param {{ defaultCountryCode?: string, requireEnabled?: boolean }} [opts]
 */
export async function sendWhatsAppTemplate(to, { name, languageCode = 'en_US', components = [] }, opts = {}) {
  if (!name) return { ok: false, error: 'missing_template_name' };
  return dispatch(
    to,
    {
      type: 'template',
      template: {
        name,
        language: { code: languageCode },
        ...(components.length ? { components } : {}),
      },
    },
    opts,
  );
}

// ── Connection test ─────────────────────────────────────────────────────────

const TEST_TIMEOUT_MS = 10_000;

/**
 * Verify the saved (or provided) credentials by reading the phone number's
 * metadata from the Graph API. Never throws — returns a structured result.
 * By default it uses the securely stored credentials so the token is never
 * round-tripped through the browser.
 *
 * @returns {Promise<{ok: boolean, error?: string, data?: object}>}
 */
export async function testWhatsAppConnection() {
  const cfg = await getWhatsAppConfig();
  const token = cfg.accessToken;
  const phoneNumberId = cfg.phoneNumberId;
  if (!token || !phoneNumberId) {
    return { ok: false, error: 'missing_credentials' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  try {
    const url =
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}` +
      `?fields=verified_name,display_phone_number,quality_rating`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: json?.error?.message || `http_${res.status}` };
    }
    return {
      ok: true,
      data: {
        verified_name: json?.verified_name ?? null,
        display_phone_number: json?.display_phone_number ?? null,
        quality_rating: json?.quality_rating ?? null,
      },
    };
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, error: 'timeout' };
    logger.logSwallowed('testWhatsAppConnection', err);
    return { ok: false, error: 'network_error' };
  } finally {
    clearTimeout(timer);
  }
}
