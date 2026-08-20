import { createServiceClient } from '@/lib/supabase/service';
import { STORE_ID, normalizeEnvironment } from '@/lib/stripe/config';
import { encryptToken, decryptToken } from '@/lib/stripe/crypto';
import { logger } from '@/lib/logger';

/**
 * Tenant-scoped data access for the store's Stripe connection.
 *
 * Every function is keyed by {@link STORE_ID} so a deployment can only ever
 * read or write its own row — one store can never reach another store's Stripe
 * account. Uses the service-role client (RLS grants no client access) and lives
 * entirely server-side. Encrypted tokens are decrypted only on explicit request
 * via {@link getStripeAccessToken}; they are never returned by the sanitized
 * status helpers used to feed the admin UI.
 */

const DISCONNECTED = Object.freeze({
  store_id: STORE_ID,
  stripe_account_id: null,
  environment: 'test',
  status: 'disconnected',
  livemode: null,
  account_email: null,
  account_name: null,
  metadata: {},
  webhook_status: 'inactive',
  connected_at: null,
  last_synced_at: null,
});

/** Raw connection row for this tenant, or null when none exists yet. */
export async function getStripeConnectionRow() {
  const db = createServiceClient();
  const { data, error } = await db
    .from('stripe_connections')
    .select('*')
    .eq('store_id', STORE_ID)
    .maybeSingle();
  if (error) {
    logger.warn('getStripeConnectionRow: DB error (table may not exist yet)', error);
    return null;
  }
  return data ?? null;
}

/**
 * Connection info safe to hand to the admin UI — NEVER includes token material.
 * Always returns a well-formed object, even when nothing is connected yet.
 */
export async function getStripeConnectionStatus() {
  const row = await getStripeConnectionRow();
  if (!row) return { ...DISCONNECTED };
  return {
    store_id: row.store_id,
    stripe_account_id: row.stripe_account_id,
    environment: normalizeEnvironment(row.environment),
    status: row.status,
    livemode: row.livemode,
    account_email: row.account_email,
    account_name: row.account_name,
    metadata: row.metadata ?? {},
    webhook_status: row.webhook_status,
    connected_at: row.connected_at,
    last_synced_at: row.last_synced_at,
  };
}

/** True when this tenant currently has an active Stripe connection. */
export async function isStripeConnected() {
  const row = await getStripeConnectionRow();
  return Boolean(row && row.status === 'connected' && row.stripe_account_id);
}

/**
 * Upsert the tenant's connection row. Token fields are encrypted here if the
 * caller passes raw `access_token` / `refresh_token`.
 */
export async function upsertStripeConnection(patch = {}) {
  const db = createServiceClient();
  const row = { store_id: STORE_ID, updated_at: new Date().toISOString() };

  if ('access_token' in patch) {
    row.access_token_encrypted = encryptToken(patch.access_token);
    delete patch.access_token;
  }
  if ('refresh_token' in patch) {
    row.refresh_token_encrypted = encryptToken(patch.refresh_token);
    delete patch.refresh_token;
  }
  if ('environment' in patch) patch.environment = normalizeEnvironment(patch.environment);

  Object.assign(row, patch);

  const { data, error } = await db
    .from('stripe_connections')
    .upsert(row, { onConflict: 'store_id' })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Mark the tenant's connection as disconnected/revoked, clearing secrets. */
export async function clearStripeConnection(status = 'disconnected') {
  return upsertStripeConnection({
    status,
    stripe_account_id: null,
    access_token_encrypted: null,
    refresh_token_encrypted: null,
    scope: null,
    livemode: null,
    account_email: null,
    account_name: null,
    webhook_status: 'inactive',
    connected_at: null,
  });
}

/**
 * Decrypted OAuth access token for server-side Stripe API calls, or null.
 * Server-only — never expose the return value to the browser.
 */
export async function getStripeAccessToken() {
  const row = await getStripeConnectionRow();
  if (!row?.access_token_encrypted) return null;
  try {
    return decryptToken(row.access_token_encrypted);
  } catch (err) {
    logger.error('getStripeAccessToken: failed to decrypt token', err);
    return null;
  }
}
