import { NextResponse } from 'next/server'

// Cache-warming cron for /api/predictions.
// The predictions route takes ~30-60s cold (throttled API-Football calls + GPT-4o)
// but ~50ms warm. revalidate=14400 means the cache holds for 4 hours.
// With this cron firing every 3 hours, the next user always hits a warm cache.
//
// Auth: Vercel cron OR Bearer ${CRON_SECRET}
// Vercel cron path: see vercel.json

export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  try {
    const res = await fetch(`${APP_URL}/api/predictions`, {
      headers: { 'Cache-Control': 'no-cache' },
      next: { revalidate: 0 },
    })
    const data = await res.json()
    const ms = Date.now() - start
    return NextResponse.json({
      success: res.ok,
      duration_ms: ms,
      predictions_count: data?.predictions?.length ?? 0,
      leagues_with_fixtures: data?.meta?.leagues_with_fixtures ?? null,
      api_failures: data?.meta?.api_failures ?? null,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, duration_ms: Date.now() - start }, { status: 500 })
  }
}
