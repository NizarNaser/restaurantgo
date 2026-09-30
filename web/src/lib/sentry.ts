import * as Sentry from '@sentry/react';

/**
 * No-op until VITE_SENTRY_DSN is set, mirroring the API's own Sentry wiring
 * (bootstrap/app.php) — this app previously had no error monitoring at all.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}
