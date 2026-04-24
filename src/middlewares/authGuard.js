// Authentication Guard / Checker Middleware
import { createClient } from '@/lib/supabase/server';
import { UnauthorizedError } from '@/common/errors/AppError';

export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError('You must be logged in to access this resource');
  }

  return user;
}
