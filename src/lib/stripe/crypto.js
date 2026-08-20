import crypto from 'node:crypto';
import { env } from '@/config/env';

/**
 * Symmetric encryption for Stripe OAuth tokens stored at rest.
 *
 * Tokens are encrypted with AES-256-GCM before being written to
 * `stripe_connections` and decrypted only inside server code that needs to call
 * Stripe on the connected account's behalf. They are NEVER sent to the browser.
 *
 * The 32-byte key is derived (SHA-256) from `STRIPE_TOKEN_ENCRYPTION_KEY`, or
 * the Supabase service-role key as a fallback, so the integration works on a
 * fresh deployment without extra configuration.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function getKey() {
  const secret = env.STRIPE_TOKEN_ENCRYPTION_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('No encryption secret available for Stripe tokens');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string. Returns a compact `base64(iv|tag|ciphertext)`
 * envelope, or null for empty/nullish input.
 */
export function encryptToken(plaintext) {
  if (plaintext == null || plaintext === '') return null;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypts a value produced by {@link encryptToken}. Returns null for nullish
 * input and throws if the envelope is malformed or tampered with.
 */
export function decryptToken(envelope) {
  if (envelope == null || envelope === '') return null;
  const buf = Buffer.from(String(envelope), 'base64');
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + 16);
  const ciphertext = buf.subarray(IV_BYTES + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
