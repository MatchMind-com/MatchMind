import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export const revalidate = 1800

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

function getCurrentSeason() {
  const now = new Date()
  return (now.getMonth() + 1) >= 8 ? now.getFullYear() : now.getFullYear() - 1
}

function getDatePlusDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

async function apiFetch(path: string) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 1800 },
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
  return {
    home: parseFloat(mw?.values?.find((v: any) => v.value === 'Home')?.odd || '0') || null,
    draw: parseFloat(mw?.values?.find((v: any) => v.value === 'Draw')?.odd || '0') || null,
    away: parseFloat(mw?.values?.find((v: any) => v.value === 'Away')?.odd || '0') || null,
    over25: parseFloat(ou?.values?.find((v: any) => v.value === 'Over 2.5')?.odd || '0') || null,
    btts: parseFloat(btts?.values?.find((v: any) => v.value === 'Yes')?.odd || '0') || null,
  }
}

function calcEV(aiPct: number, odds: number) {
  if (!odds || odds <= 1) return null
  return Math.round(((aiPct / 100) * odds - 1) * 100)
}

function formatForm(fixtures: any[], teamId: number): string {
  if (!fixtures?.length) return 'No data'
  return fixtures.slice(0, 5).map((f: any) => {
    const isHome = f.teams?.home?.id === teamId
    const scored = isHome ? f.goals?.home ?? 0 : f.goals?.away ?? 0
    const conceded = isHome ? f.goals?.away ?? 0 : f.goals?.home ?? 0
    const opp = isHome ? f.teams?.away?.name : f.teams?.home?.name
    const result = scored > conceded ? 'W' : scored < conceded ? 'L' : 'D'
    return `${result} ${scored}-${conceded} vs ${opp}`
  }).join(' | ')
}

const LEAGUES = [
  { id: 39,  name: 'Premier League',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, name: 'La Liga',           flag: '🇪🇸' },
  { id: 78,  name: 'Bundesliga',        flag: '🇩🇪' },
  { id: 135, name: 'Serie A',           flag: '🇮🇹' },
  { id: 61,  name: 'Ligue 1',           flag: '🇫🇷' },
  { id: 2,   name: 'Champions League',  flag: '🏆' },
  { id: 3,   name: 'Europa League',     flag: '🥈' },
  { id: 88,  name: 'Eredivisie',        flag: '🇳🇱' },
  { id: 94,  name: 'Primeira Liga',     flag: '🇵🇹' },
]

export async function GET() {
  try {
    const season = getCurrentSeason()
    const today = new Date().toISOString().split('T')[0]
    const in3days = getDatePlusDays(3)

    // Fetch next 3 days — not just today (fixes "no acca in evenings" issue)
    const leagueData = await Promise.all(
      LEAGUES.map(async (league) => {
        const [fixtures, oddsData] = await Promise.all([
          apiFetch(`/fixtures?league=${league.id}&season=${season}&from=${today}&to=${in3days}&status=NS`),
          apiFetch(`/odds?league=${league.id}&season=${season}&date=${today}&bookmaker=1`),
        ])

        const oddsMap: Record<number, ReturnType<typeof extractOdds>> = {}
        if (oddsData) {
          for (const entry of oddsData) {
            const fid = entry.fixture?.id
            const bk = entry.bookmakers?.[0]
            if (fid && bk) oddsMap[fid] = extractOdds(bk)
          }
        }
        return { league, fixtures: fixtures || [], oddsMap }
      })
    )

    // Candidates: fixtures with real odds from different leagues
    const candidates: Array<{
      fixture: any; league: typeof LEAGUES[0]
      odds: NonNullable<ReturnType<typeof extractOdds>>
    }> = []

    for (const { league, fixtures, oddsMap } of leagueData) {
      for (const f of fixtures.slice(0, 4)) {
        const o = oddsMap[f.fixture?.id]
        if (o && (o.home || o.over25 || o.btts)) {
          candidates.push({ fixture: f, league, odds: o as any })
        }
      }
    }

    if (candidates.length < 3) {
      // Fallback: use fixtures even without odds
      const allFixtures = leagueData.flatMap(({ league, fixtures }) =>
        fixtures.slice(0, 2).map(f => ({
          fixture: f, league,
          odds: { home: null, draw: null, away: null, over25: null, btts: null } as any,
        }))
      )
      if (allFixtures.length < 3) {
        return NextResponse.json({ success: true, acca: null, message: 'No upcoming fixtures found' })
      }
      candidates.push(...allFixtures.slice(0, 6))
    }

    // Fetch form for top candidates
    const topCandidates = candidates.slice(0, 9)
    const formResults = await Promise.all(
      topCandidates.map(async (c) => {
        const homeId = c.fixture.teams?.home?.id
        const awayId = c.fixture.teams?.away?.id
        const [homeForm, awayForm] = await Promise.all([
          apiFetch(`/fixtures?team=${homeId}&last=5`),
          apiFetch(`/fixtures?team=${awayId}&last=5`),
        ])
        return { homeId, awayId, homeForm, awayForm }
      })
    )

    const fixtureList = topCandidates.map((c, i) => {
      const home = c.fixture.teams?.home?.name
      const away = c.fixture.teams?.away?.name
      const date = new Date(c.fixture.fixture?.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      const o = c.odds
      const oddsStr = o?.home ? ` | H ${o.home} / D ${o.draw} / A ${o.away} / O2.5 ${o.over25 ?? 'N/A'} / BTTS ${o.btts ?? 'N/A'}` : ''
      const fd = formResults[i]
      const homeF = fd?.homeForm ? formatForm(fd.homeForm, fd.homeId) : ''
      const awayF = fd?.awayForm ? formatForm(fd.awayForm, fd.awayId) : ''
      return `${i + 1}. ${home} vs ${away} | ${c.league.name} | ${date}${oddsStr}${homeF ? `\n   ${home} form: ${homeF}` : ''}${awayF ? `\n   ${away} form: ${awayF}` : ''}`
    }).join('\n\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: 'You are an elite football betting analyst. Build a 3-leg accumulator with genuine positive expected value. Use the form data and odds to find where the market is mispriced. Return valid JSON only.'
      }, {
        role: 'user',
        content: `Build a 3-leg accumulator from these upcoming fixtures. Pick legs from 3 DIFFERENT leagues. Prioritise positive EV based on form data vs the odds offered.

Fixtures:
${fixtureList}

Return JSON:
{
  "legs": [
    {
      "fixture_index": 1,
      "bet_type": "Over 2.5 Goals",
      "your_probability": 68,
      "reasoning": "Both teams averaged 2.3+ goals in last 5, weak defences on current form",
      "confidence": "High"
    }
  ],
  "acca_reasoning": "2-sentence overall rationale for this accumulator"
}`
      }],
      max_tokens: 1000,
    })

    const gptData = JSON.parse(completion.choices[0]?.message?.content || '{"legs":[]}')
    const legs = gptData.legs || []

    if (legs.length < 2) {
      return NextResponse.json({ success: true, acca: null, message: 'AI could not identify a confident accumulator' })
    }

    const accaLegs = legs.map((leg: any) => {
      const idx = Math.min((leg.fixture_index || 1) - 1, topCandidates.length - 1)
      const candidate = topCandidates[idx]
      if (!candidate) return null

      const o = candidate.odds
      const betType = leg.bet_type || 'Home Win'
      const aiPct = leg.your_probability || 55

      let relevantOdds: number | null = null
      if (betType.toLowerCase().includes('home')) relevantOdds = o.home
      else if (betType.toLowerCase().includes('away')) relevantOdds = o.away
      else if (betType.toLowerCase().includes('draw')) relevantOdds = o.draw
      else if (betType.toLowerCase().includes('over') || betType.toLowerCase().includes('2.5')) relevantOdds = o.over25
      else if (betType.toLowerCase().includes('btts') || betType.toLowerCase().includes('both')) relevantOdds = o.btts
      else relevantOdds = o.home

      const ev = relevantOdds ? calcEV(aiPct, relevantOdds) : null

      return {
        home_team: candidate.fixture.teams?.home?.name,
        away_team: candidate.fixture.teams?.away?.name,
        league: candidate.league.name,
        leagueFlag: candidate.league.flag,
        kick_off: candidate.fixture.fixture?.date,
        bet_type: betType,
        odds: relevantOdds,
        ai_probability: aiPct,
        ev_percent: ev,
        reasoning: leg.reasoning,
        confidence: leg.confidence || 'Medium',
      }
    }).filter(Boolean)

    if (accaLegs.length < 2) {
      return NextResponse.json({ success: true, acca: null, message: 'Could not build acca with valid odds' })
    }

    const combinedOdds = Math.round(
      accaLegs.reduce((prod: number, leg: any) => prod * (leg.odds || 1), 1) * 100
    ) / 100

    const avgEV = Math.round(
      accaLegs.reduce((sum: number, leg: any) => sum + (leg.ev_percent || 0), 0) / accaLegs.length
    )

    return NextResponse.json({
      success: true,
      acca: {
        legs: accaLegs,
        combined_odds: combinedOdds,
        combined_ev: avgEV,
        reasoning: gptData.acca_reasoning || '',
        generated_at: new Date().toISOString(),
      }
    })
  } catch (err: any) {
    console.error('Acca builder error:', err)
    return NextResponse.json({ success: false, error: 'Failed to build accumulator' }, { status: 500 })
  }
}
