import Stripe from 'stripe';
import { getStripeAppConfig, isStripePlatformConfigured } from '@/lib/stripe/config';

/**
 * Server-only factory for a configured Stripe client.
 *
 * The client authenticates as the PLATFORM (this application) using the
 * deployer's secret key for the requested environment. Calls that must act on
 * the connected account pass `{ stripeAccount: 'acct_...' }` per request.
 * Import only from server code — the secret key must never reach the browser.
 */

const cache = new Map();

/** Stable API version so behaviour doesn't drift when the SDK updates. */
const API_VERSION = '2024-06-20';

/**
 * Returns a Stripe client for the given environment ('test' | 'live'), or
 * throws if the deployer hasn't configured the platform secret key for it.
 */
export function getStripeClient(environment = 'test') {
  const cfg = getStripeAppConfig(environment);
  if (!cfg.secretKey) {
    const err = new Error('Stripe is not configured for this environment');
    err.code = 'stripe_not_configured';
    throw err;
  }
  const cacheKey = `${cfg.environment}:${cfg.secretKey.slice(-6)}`;
  let client = cache.get(cacheKey);
  if (!client) {
    client = new Stripe(cfg.secretKey, {
      apiVersion: API_VERSION,
      typescript: false,
      appInfo: { name: 'e-store Stripe Connect' },
    });
    cache.set(cacheKey, client);
  }
  return client;
}

export { isStripePlatformConfigured };
