export const env = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  // Comma-separated list of admin emails, e.g. "admin@example.com,boss@example.com"
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || '',

  // ── Stripe Connect (application-level, set once by the deployer) ──────────
  // These identify the PLATFORM (this application) to Stripe. The store owner
  // never touches them — they connect their own account through the OAuth flow
  // in Admin → Settings → Payment. Separate test/live values let the owner
  // switch environments without redeploying. All are server-side only except
  // the publishable keys, which are safe to expose to the browser.
  STRIPE_CLIENT_ID_TEST:   process.env.STRIPE_CLIENT_ID_TEST   || '',
  STRIPE_CLIENT_ID_LIVE:   process.env.STRIPE_CLIENT_ID_LIVE   || '',
  STRIPE_SECRET_KEY_TEST:  process.env.STRIPE_SECRET_KEY_TEST  || '',
  STRIPE_SECRET_KEY_LIVE:  process.env.STRIPE_SECRET_KEY_LIVE  || '',
  STRIPE_PUBLISHABLE_KEY_TEST: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST || '',
  STRIPE_PUBLISHABLE_KEY_LIVE: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE || '',
  STRIPE_WEBHOOK_SECRET_TEST: process.env.STRIPE_WEBHOOK_SECRET_TEST || '',
  STRIPE_WEBHOOK_SECRET_LIVE: process.env.STRIPE_WEBHOOK_SECRET_LIVE || '',
  // Key used to encrypt Stripe OAuth tokens at rest. Falls back to the service
  // role key so the integration works out of the box on a fresh deployment.
  STRIPE_TOKEN_ENCRYPTION_KEY: process.env.STRIPE_TOKEN_ENCRYPTION_KEY || '',
};