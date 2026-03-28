import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

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
  const league = searchParams.get('league') || '39' // Premier League default
  const team = searchParams.get('team')
  const fixture = searchParams.get('fixture')

  try {
    if (type === 'fixtures') {
      // Today's + next 3 days fixtures for a league
      const today = new Date().toISOString().split('T')[0]
      const data = await apiFetch(`/fixtures?league=${league}&season=2024&from=${today}&to=${getDatePlusDays(3)}`)
      return NextResponse.json({ success: true, data: data.response?.slice(0, 20) || [] })
    }

    if (type === 'live') {
      const data = await apiFetch(`/fixtures?live=all`)
      return NextResponse.json({ success: true, data: data.response?.slice(0, 20) || [] })
    }

    if (type === 'team_form' && team) {
      const data = await apiFetch(`/fixtures?team=${team}&season=2024&last=5`)
      return NextResponse.json({ success: true, data: data.response || [] })
    }

    if (type === 'injuries' && (team || league)) {
      const today = new Date().toISOString().split('T')[0]
      const query = team ? `team=${team}` : `league=${league}&season=2024`
      const data = await apiFetch(`/injuries?${query}&date=${today}`)
      return NextResponse.json({ success: true, data: data.response || [] })
    }

    if (type === 'standings' && league) {
      const data = await apiFetch(`/standings?league=${league}&season=2024`)
      const standings = data.response?.[0]?.league?.standings?.[0]?.slice(0, 10) || []
      return NextResponse.json({ success: true, data: standings })
    }

    if (type === 'fixture_stats' && fixture) {
      const data = await apiFetch(`/fixtures/statistics?fixture=${fixture}`)
      return NextResponse.json({ success: true, data: data.response || [] })
    }

    if (type === 'h2h') {
      const h2h = searchParams.get('h2h') // format: "33-40"
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
      // Return popular leagues
      const popular = [
        { id: 39, name: 'Premier League', country: 'England', logo: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
        { id: 140, name: 'La Liga', country: 'Spain', logo: '🇪🇸' },
        { id: 135, name: 'Serie A', country: 'Italy', logo: '🇮🇹' },
        { id: 78, name: 'Bundesliga', country: 'Germany', logo: '🇩🇪' },
        { id: 61, name: 'Ligue 1', country: 'France', logo: '🇫🇷' },
        { id: 2, name: 'Champions League', country: 'Europe', logo: '🏆' },
        { id: 3, name: 'Europa League', country: 'Europe', logo: '🥈' },
        { id: 848, name: 'Conference League', country: 'Europe', logo: '🥉' },
      ]
      return NextResponse.json({ success: true, data: popular })
    }

    return NextResponse.json({ success: false, error: 'Unknown type' }, { status: 400 })
  } catch (err: any) {
    console.error('API-Football error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

function getDatePlusDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
