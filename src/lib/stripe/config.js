import { env } from '@/config/env';

/**
 * Server-only Stripe Connect configuration. Import only from server code
 * (route handlers, server actions) — it reads secret platform credentials.
 *
 * A single deployment == a single tenant. `STORE_ID` is the tenant key used in
 * the `stripe_connections` table so the same codebase can be deployed for many
 * different store owners without any source changes.
 */
export const STORE_ID = process.env.STRIPE_STORE_ID || 'default';

export const STRIPE_ENVIRONMENTS = ['test', 'live'];

/** Normalize an arbitrary value to a valid environment, defaulting to 'test'. */
export function normalizeEnvironment(value) {
  return value === 'live' ? 'live' : 'test';
}

/**
 * Returns the application-level Stripe config for the given environment.
 * `secretKey`, `clientId` and `webhookSecret` are NEVER exposed to the client —
 * only ever read inside server code (API routes / server actions).
 */
export function getStripeAppConfig(environment = 'test') {
  const envName = normalizeEnvironment(environment);
  if (envName === 'live') {
    return {
      environment: 'live',
      clientId: env.STRIPE_CLIENT_ID_LIVE,
      secretKey: env.STRIPE_SECRET_KEY_LIVE,
      publishableKey: env.STRIPE_PUBLISHABLE_KEY_LIVE,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET_LIVE,
    };
  }
  return {
    environment: 'test',
    clientId: env.STRIPE_CLIENT_ID_TEST,
    secretKey: env.STRIPE_SECRET_KEY_TEST,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY_TEST,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET_TEST,
  };
}

/**
 * True when the deployer has provided the minimum platform credentials needed
 * to run the Stripe Connect OAuth flow for the given environment. Without this
 * the "Connect with Stripe" button is disabled in the admin UI.
 */
export function isStripePlatformConfigured(environment = 'test') {
  const cfg = getStripeAppConfig(environment);
  return Boolean(cfg.clientId && cfg.secretKey);
}

/** Absolute URL Stripe redirects back to after the owner authorizes. */
export function getStripeRedirectUri() {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  return `${base}/api/v1/admin/stripe/callback`;
}
