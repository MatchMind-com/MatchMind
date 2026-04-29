/**
 * /api/fixtures/live — currently in-play matches from API-Football.
 * Used by the Live Matches dashboard page.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await fetch(`${BASE}/fixtures?live=all`, {
      headers: { 'x-apisports-key': API_KEY },
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream error', matches: [] }, { status: 502 })
    }
    const json = await res.json()
    const list = (json.response || []).map((fx: any) => ({
      id: fx.fixture?.id,
      status: fx.fixture?.status?.short,
      minute: fx.fixture?.status?.elapsed,
      league: { id: fx.league?.id, name: fx.league?.name, logo: fx.league?.logo, country: fx.league?.country },
      home: { id: fx.teams?.home?.id, name: fx.teams?.home?.name, logo: fx.teams?.home?.logo, goals: fx.goals?.home },
      away: { id: fx.teams?.away?.id, name: fx.teams?.away?.name, logo: fx.teams?.away?.logo, goals: fx.goals?.away },
    }))
    return NextResponse.json({ matches: list, count: list.length })
  } catch (err: any) {
    console.error('[fixtures/live] error:', err)
    return NextResponse.json({ error: 'Failed to load live matches', matches: [] }, { status: 500 })
  }
}
