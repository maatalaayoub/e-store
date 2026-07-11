/**
 * Minimal structured logger.
 *
 * - In development: writes to stderr/stdout.
 * - In production: still writes to stderr (Vercel/Node will capture it).
 *
 * To wire in Sentry/Datadog/Logflare later, swap the implementation of
 * `captureError` and `captureMessage`. Keep the public API stable.
 */

const IS_DEV = process.env.NODE_ENV !== 'production';

function now() {
  return new Date().toISOString();
}

function safeError(err) {
  if (err == null) return { message: 'unknown error' };
  if (typeof err === 'string') return { message: err };
  return {
    message: err.message ?? 'unknown error',
    code: err.code ?? undefined,
    statusCode: err.statusCode ?? undefined,
    stack: err.stack ?? undefined,
  };
}

export const logger = {
  error(context, err) {
    const payload = {
      level: 'error',
      timestamp: now(),
      context,
      ...safeError(err),
    };
    // eslint-disable-next-line no-console
    if (IS_DEV) console.error(payload);
    else console.error(JSON.stringify(payload));
  },

  warn(context, err) {
    const payload = {
      level: 'warn',
      timestamp: now(),
      context,
      ...safeError(err),
    };
    // eslint-disable-next-line no-console
    if (IS_DEV) console.warn(payload);
    else console.warn(JSON.stringify(payload));
  },

  info(context, meta) {
    const payload = {
      level: 'info',
      timestamp: now(),
      context,
      ...meta,
    };
    // eslint-disable-next-line no-console
    if (IS_DEV) console.log(payload);
    else console.log(JSON.stringify(payload));
  },

  /**
   * Use in best-effort paths (notifications, webhooks, telemetry) where the
   * operation must never fail the user request, but failures must still be
   * observable for debugging and alerting.
   */
  logSwallowed(context, err) {
    this.warn(context, err);
  },
};
