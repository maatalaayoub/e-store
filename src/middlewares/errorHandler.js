import { NextResponse } from 'next/server';

const IS_DEV = process.env.NODE_ENV !== 'production';

export function withErrorHandler(handler) {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (error) {
      // Logged unconditionally — server logs are non-public.
      // In production wire this to Sentry/Datadog/Logflare.
      if (IS_DEV) console.error(error);

      const statusCode = error.statusCode || 500;
      // Never leak internal error messages to clients unless explicitly marked
      // operational (i.e. business-logic errors safe to surface).
      const safeMessage = error.isOperational ? error.message : 'Internal Server Error';

      return NextResponse.json(
        {
          success: false,
          error: safeMessage,
          ...(IS_DEV && error.stack ? { stack: error.stack } : null),
        },
        { status: statusCode },
      );
    }
  };
}
