import { createClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

/**
 * Service-role Supabase client — bypasses Row Level Security.
 * Use ONLY in server-side code (API routes, Server Actions).
 * Never expose this client or the service role key to the browser.
 */
export function createServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
