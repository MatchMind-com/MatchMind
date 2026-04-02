import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

// Returns the current football season year (e.g. April 2026 → 2025 for 2025/26 season)
function getCurrentSeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const year = now.getFullYear()
  return month >= 8 ? year : year - 1
}

function getDatePlusDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
    next: { revalidate: 300 }, // cache 5 min
  })
  if (!res.ok) throw new Error(`API-Football error: ${res.status}`)
  return res.json()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'fixtures'
  const league = searchParams.get('league') || '39'
  const team = searchParams.get('team')
  const fixture = searchParams.get('fixture')
  const season = getCurrentSeason()

  try {
    if (type === 'fixtures') {
      const today = new Date().toISOString().split('T')[0]
      const data = await apiFetch(`/fixtures?league=${league}&season=${season}&from=${today}&to=${getDatePlusDays(7)}`)
      return NextResponse.json({ success: true, data: data.response?.slice(0, 30) || [] })
    }

    if (type === 'live') {
      const data = await apiFetch(`/fixtures?live=all`)
      return NextResponse.json({ success: true, data: data.response?.slice(0, 30) || [] })
    }

    if (type === 'results') {
      // Last 7 days of results
      const from = getDatePlusDays(-7)
      const yesterday = getDatePlusDays(-1)
      const data = await apiFetch(`/fixtures?league=${league}&season=${season}&from=${from}&to=${yesterday}&status=FT`)
      return NextResponse.json({ success: true, data: data.response?.slice(0, 20) || [] })
    }

    if (type === 'team_form' && team) {
      const data = await apiFetch(`/fixtures?team=${team}&season=${season}&last=6`)
      return NextResponse.json({ success: true, data: data.response || [] })
    }

    if (type === 'injuries' && (team || league)) {
      const today = new Date().toISOString().split('T')[0]
      const query = team ? `team=${team}` : `league=${league}&season=${season}`
      const data = await apiFetch(`/injuries?${query}&date=${today}`)
      return NextResponse.json({ success: true, data: data.response || [] })
    }

    if (type === 'standings' && league) {
      const data = await apiFetch(`/standings?league=${league}&season=${season}`)
      const standings = data.response?.[0]?.league?.standings?.[0]?.slice(0, 20) || []
      return NextResponse.json({ success: true, data: standings })
    }

    if (type === 'top_scorers' && league) {
      const data = await apiFetch(`/players/topscorers?league=${league}&season=${season}`)
      return NextResponse.json({ success: true, data: data.response?.slice(0, 10) || [] })
    }

    if (type === 'fixture_stats' && fixture) {
      const data = await apiFetch(`/fixtures/statistics?fixture=${fixture}`)
      return NextResponse.json({ success: true, data: data.response || [] })
    }

    if (type === 'h2h') {
      const h2h = searchParams.get('h2h')
      if (!h2h) return NextResponse.json({ success: false, error: 'h2h param required' })
      const data = await apiFetch(`/fixtures/headtohead?h2h=${h2h}&last=5`)
      return NextResponse.json({ success: true, data: data.response || [] })
    }

    if (type === 'search_team') {
      const name = searchParams.get('name')
      if (!name) return NextResponse.json({ success: false, error: 'name param required' })
      const data = await apiFetch(`/teams?search=${encodeURIComponent(name)}`)
      return NextResponse.json({ success: true, data: data.response || [] })
    }

    if (type === 'leagues') {
      const popular = [
        { id: 39,  name: 'Premier League',      country: 'England',     flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
        { id: 140, name: 'La Liga',              country: 'Spain',       flag: '🇪🇸' },
        { id: 135, name: 'Serie A',              country: 'Italy',       flag: '🇮🇹' },
        { id: 78,  name: 'Bundesliga',           country: 'Germany',     flag: '🇩🇪' },
        { id: 61,  name: 'Ligue 1',              country: 'France',      flag: '🇫🇷' },
        { id: 2,   name: 'Champions League',     country: 'Europe',      flag: '🏆' },
        { id: 3,   name: 'Europa League',        country: 'Europe',      flag: '🥈' },
        { id: 848, name: 'Conference League',    country: 'Europe',      flag: '🥉' },
        { id: 40,  name: 'Championship',         country: 'England',     flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
        { id: 88,  name: 'Eredivisie',           country: 'Netherlands', flag: '🇳🇱' },
        { id: 94,  name: 'Primeira Liga',        country: 'Portugal',    flag: '🇵🇹' },
        { id: 203, name: 'Süper Lig',            country: 'Turkey',      flag: '🇹🇷' },
        { id: 179, name: 'Scottish Premiership', country: 'Scotland',    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
        { id: 144, name: 'Belgian Pro League',   country: 'Belgium',     flag: '🇧🇪' },
        { id: 253, name: 'MLS',                  country: 'USA',         flag: '🇺🇸' },
      ]
      return NextResponse.json({ success: true, data: popular })
    }

    return NextResponse.json({ success: false, error: 'Unknown type' }, { status: 400 })
  } catch (err: any) {
    console.error('API-Football error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
