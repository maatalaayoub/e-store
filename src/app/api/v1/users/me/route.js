import { NextResponse } from 'next/server';
import { requireAuth } from '@/middlewares/authGuard';
import { withErrorHandler } from '@/middlewares/errorHandler';

// Protected Example:
export const GET = withErrorHandler(async (req) => {
  const user = await requireAuth();

  return NextResponse.json({
    success: true,
    data: { id: user.id, email: user.email },
  });
});
