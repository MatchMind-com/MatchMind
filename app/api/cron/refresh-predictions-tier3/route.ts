/**
 * Tier 3 refresh — South America, Asia, intl + smaller European
 * (~18 leagues). Thin wrapper around /api/cron/refresh-predictions?tier=3.
 */
import { NextResponse } from 'next/server'
import { GET as refreshGET } from '../refresh-predictions/route'

// Wrapper is the serverless function Vercel deploys — its maxDuration
// governs the whole request, not the underlying route's 300s deadline.
export const maxDuration = 300

export async function GET(req: Request) {
  const url = new URL(req.url)
  url.pathname = '/api/cron/refresh-predictions'
  url.searchParams.set('tier', '3')
  const proxied = new Request(url.toString(), { headers: req.headers })
  try {
    return await refreshGET(proxied)
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
