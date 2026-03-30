/**
 * Minimal server-side Sentry reporter using the HTTP Store API.
 * No SDK dependency — works in any Node.js / Vercel serverless environment.
 *
 * Set SENTRY_DSN in Vercel environment variables:
 *   sentry.io → Your Project → Settings → Client Keys (DSN)
 */
export async function captureException(err, context = {}) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || !err) return;
  try {
    const url       = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, '');
    const endpoint  = `${url.protocol}//${url.host}/api/${projectId}/store/`;
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${url.username}`,
      },
      body: JSON.stringify({
        platform:  'node',
        level:     'error',
        timestamp: new Date().toISOString(),
        exception: {
          values: [{
            type:  err.name  || 'Error',
            value: err.message || String(err),
          }],
        },
        extra: context,
      }),
    });
  } catch {
    // Never let error reporting crash the app
  }
}
