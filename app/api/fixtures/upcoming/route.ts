import { NextResponse } from 'next/server'

export const revalidate = 300 // 5-min cache — fresh enough for a form picker

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

const LEAGUES = [
  { id: 39,  name: 'Premier League',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, name: 'La Liga',           flag: '🇪🇸' },
  { id: 78,  name: 'Bundesliga',        flag: '🇩🇪' },
  { id: 135, name: 'Serie A',           flag: '🇮🇹' },
  { id: 61,  name: 'Ligue 1',          flag: '🇫🇷' },
  { id: 2,   name: 'Champions League',  flag: '🏆' },
  { id: 3,   name: 'Europa League',     flag: '🥈' },
  { id: 848, name: 'Conference League', flag: '🥉' },
  { id: 88,  name: 'Eredivisie',        flag: '🇳🇱' },
  { id: 94,  name: 'Primeira Liga',     flag: '🇵🇹' },
  { id: 40,  name: 'Championship',      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 203, name: 'Süper Lig',         flag: '🇹🇷' },
]

function getCurrentSeason() {
  const now = new Date()
  return now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1
}

function getDate(daysAhead: number) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().split('T')[0]
}

async function apiFetch(path: string) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.response || null
  } catch { return null }
}

function extractOdds(bookmaker: any) {
  if (!bookmaker) return null
  const bets = bookmaker.bets || []
  const mw = bets.find((b: any) => b.id === 1)
  const ou = bets.find((b: any) => b.id === 5)
  const btts = bets.find((b: any) => b.id === 8)
  const p = (val: string | undefined) => { const n = parseFloat(val || '0'); return n > 1 ? n : null }
  return {
    home:   p(mw?.values?.find((v: any) => v.value === 'Home')?.odd),
    draw:   p(mw?.values?.find((v: any) => v.value === 'Draw')?.odd),
    away:   p(mw?.values?.find((v: any) => v.value === 'Away')?.odd),
    over25: p(ou?.values?.find((v: any) => v.value === 'Over 2.5')?.odd),
    btts:   p(btts?.values?.find((v: any) => v.value === 'Yes')?.odd),
  }
}

export async function GET() {
  const season = getCurrentSeason()
  const today = getDate(0)
  const tomorrow = getDate(1)
  const dayAfter = getDate(2)

  try {
    // Fixtures for 3 days + Bet365 odds for today + tomorrow (all in parallel)
    const [fixtureResults, oddsToday, oddsTomorrow] = await Promise.all([
      Promise.all(
        LEAGUES.map(league =>
          apiFetch(`/fixtures?league=${league.id}&season=${season}&from=${today}&to=${dayAfter}&status=NS`)
            .then(data => ({ league, data }))
        )
      ),
      Promise.all(LEAGUES.map(l => apiFetch(`/odds?league=${l.id}&season=${season}&date=${today}&bookmaker=1`))),
      Promise.all(LEAGUES.map(l => apiFetch(`/odds?league=${l.id}&season=${season}&date=${tomorrow}&bookmaker=1`))),
    ])

    // Merge all odds into a single fixture_id → odds map
    const oddsMap: Record<number, ReturnType<typeof extractOdds>> = {}
    for (const oddsArr of [...oddsToday, ...oddsTomorrow]) {
      if (!oddsArr) continue
      for (const entry of oddsArr) {
        const fid = entry.fixture?.id
        const bk = entry.bookmakers?.[0]
        if (fid && bk && !oddsMap[fid]) oddsMap[fid] = extractOdds(bk)
      }
    }

    // Build clean fixture list
    const seen = new Set<number>()
    const fixtures: any[] = []
    for (const { league, data } of fixtureResults) {
      if (!data) continue
      for (const f of data) {
        const id = f.fixture?.id
        if (!id || seen.has(id)) continue
        seen.add(id)
        fixtures.push({
          id,
          date: f.fixture?.date,
          home_team: f.teams?.home?.name,
          home_logo: f.teams?.home?.logo,
          away_team: f.teams?.away?.name,
          away_logo: f.teams?.away?.logo,
          league: league.name,
          league_flag: league.flag,
          odds: oddsMap[id] ?? null,
        })
      }
    }

    fixtures.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return NextResponse.json({ success: true, fixtures })
  } catch (err) {
    console.error('Upcoming fixtures error:', err)
    return NextResponse.json({ success: false, fixtures: [] })
  }
}
