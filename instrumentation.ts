// Next.js 14 instrumentation hook — dispatches to the right Sentry config
// based on runtime. No-op when no DSN is set.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
