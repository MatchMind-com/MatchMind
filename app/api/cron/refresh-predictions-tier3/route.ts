/**
 * Tier 3 refresh — last 9 leagues. Thin wrapper around /api/cron/refresh-predictions?tier=3.
 */
import { NextResponse } from 'next/server'
import { GET as refreshGET } from '../refresh-predictions/route'

export const maxDuration = 60

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
