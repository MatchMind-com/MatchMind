/**
 * Sentry — browser-side init.
 *
 * This file does nothing at runtime unless NEXT_PUBLIC_SENTRY_DSN is set.
 * To enable: add your DSN in Vercel env and redeploy.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
  })
}
