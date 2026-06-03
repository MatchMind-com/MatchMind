/**
 * Tier 1 refresh — top European leagues + UEFA cups + major domestic cups
 * (~14 leagues). Thin wrapper around /api/cron/refresh-predictions?tier=1.
 * Scheduled separately in vercel.json so each tier gets its own 300s budget.
 * Wrapper is the actual serverless function — its maxDuration governs the
 * whole request, not the underlying refresh-predictions route's deadline.
 */
import { NextResponse } from 'next/server'
import { GET as refreshGET } from '../refresh-predictions/route'

export const maxDuration = 300

export async function GET(req: Request) {
  const url = new URL(req.url)
  url.pathname = '/api/cron/refresh-predictions'
  url.searchParams.set('tier', '1')
  const proxied = new Request(url.toString(), { headers: req.headers })
  try {
    return await refreshGET(proxied)
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
