import { NextResponse } from 'next/server';

export function withErrorHandler(handler) {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (error) {
      console.error(error); // In production, send to Sentry or Datadog

      const statusCode = error.statusCode || 500;
      const message = error.isOperational ? error.message : 'Internal Server Error';

      return NextResponse.json(
        {
          success: false,
          error: message,
          ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
        },
        { status: statusCode }
      );
    }
  };
}
