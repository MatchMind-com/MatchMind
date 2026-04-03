import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export const revalidate = 3600 // rebuild acca once per hour

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

function getCurrentSeason() {
  const now = new Date()
  return (now.getMonth() + 1) >= 8 ? now.getFullYear() : now.getFullYear() - 1
}

async function apiFetch(path: string) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 3600 },
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

const LEAGUES = [
  { id: 39, name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, name: 'La Liga', flag: '🇪🇸' },
  { id: 78, name: 'Bundesliga', flag: '🇩🇪' },
  { id: 135, name: 'Serie A', flag: '🇮🇹' },
  { id: 61, name: 'Ligue 1', flag: '🇫🇷' },
  { id: 2, name: 'Champions League', flag: '🏆' },
  { id: 88, name: 'Eredivisie', flag: '🇳🇱' },
  { id: 94, name: 'Primeira Liga', flag: '🇵🇹' },
]

export async function GET() {
  try {
    const season = getCurrentSeason()
    const today = new Date().toISOString().split('T')[0]

    // Fetch today's fixtures + odds from each league in parallel
    const leagueData = await Promise.all(
      LEAGUES.map(async (league) => {
        const [fixtures, oddsData] = await Promise.all([
          apiFetch(`/fixtures?league=${league.id}&season=${season}&date=${today}&status=NS`),
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

    // Build candidate list: fixtures with real odds available
    const candidates: Array<{
      fixture: any
      league: typeof LEAGUES[0]
      odds: NonNullable<ReturnType<typeof extractOdds>>
    }> = []

    for (const { league, fixtures, oddsMap } of leagueData) {
      for (const f of fixtures.slice(0, 3)) {
        const o = oddsMap[f.fixture?.id]
        if (o && (o.home || o.over25 || o.btts)) {
          candidates.push({ fixture: f, league, odds: o as any })
        }
      }
    }

    if (candidates.length < 3) {
      return NextResponse.json({
        success: true,
        acca: null,
        message: 'Not enough fixtures with odds available today',
      })
    }

    // Ask AI to pick the best 3 legs from different leagues
    const fixtureList = candidates.map((c, i) => {
      const home = c.fixture.teams?.home?.name
      const away = c.fixture.teams?.away?.name
      const o = c.odds
      return `${i + 1}. ${home} vs ${away} | ${c.league.name} | Bet365: H ${o.home ?? 'N/A'} / D ${o.draw ?? 'N/A'} / A ${o.away ?? 'N/A'} / Over2.5 ${o.over25 ?? 'N/A'} / BTTS ${o.btts ?? 'N/A'}`
    }).join('\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: 'You are an expert football betting analyst. Your job is to build an accumulator (multi-bet) from the provided fixtures by selecting exactly 3 legs — each from a DIFFERENT league — where you have genuine positive expected value. Focus on the highest probability outcomes with the best value odds. Return valid JSON only.'
      }, {
        role: 'user',
        content: `Today's fixtures with Bet365 odds:

${fixtureList}

Rules:
- Pick exactly 3 legs from 3 DIFFERENT leagues
- Each leg must have positive EV (your estimated probability > implied odds probability)
- Prefer Over 2.5 or BTTS for high-scoring leagues, Home/Away Win for clear favourites
- Provide your probability estimate for each selected bet

Return JSON:
{
  "legs": [
    {
      "fixture_index": 1,
      "bet_type": "Over 2.5 Goals",
      "your_probability": 68,
      "reasoning": "Both teams score in 4 of last 5, strong attack vs weak defence",
      "confidence": "High"
    }
  ],
  "acca_reasoning": "Brief overall reasoning for this accumulator"
}`
      }],
      max_tokens: 800,
    })

    const gptData = JSON.parse(completion.choices[0]?.message?.content || '{"legs":[]}')
    const legs = gptData.legs || []

    if (legs.length < 2) {
      return NextResponse.json({ success: true, acca: null, message: 'AI could not build a confident accumulator today' })
    }

    // Build the acca legs with real odds and EV
    const accaLegs = legs.map((leg: any) => {
      const idx = (leg.fixture_index || 1) - 1
      const candidate = candidates[Math.min(idx, candidates.length - 1)]
      if (!candidate) return null

      const o = candidate.odds
      const betType = leg.bet_type || 'Home Win'
      const aiPct = leg.your_probability || 55

      // Get the relevant odds for this bet type
      let relevantOdds: number | null = null
      if (betType.toLowerCase().includes('home')) relevantOdds = o.home
      else if (betType.toLowerCase().includes('away')) relevantOdds = o.away
      else if (betType.toLowerCase().includes('draw')) relevantOdds = o.draw
      else if (betType.toLowerCase().includes('over') || betType.toLowerCase().includes('2.5')) relevantOdds = o.over25
      else if (betType.toLowerCase().includes('btts') || betType.toLowerCase().includes('both')) relevantOdds = o.btts
      else relevantOdds = o.home // fallback

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

    // Combined odds and combined EV
    const combinedOdds = accaLegs.reduce((prod: number, leg: any) => prod * (leg.odds || 1), 1)
    const roundedCombinedOdds = Math.round(combinedOdds * 100) / 100

    // Combined EV: geometric mean of individual EVs (simplified)
    const avgEV = accaLegs.reduce((sum: number, leg: any) => sum + (leg.ev_percent || 0), 0) / accaLegs.length

    return NextResponse.json({
      success: true,
      acca: {
        legs: accaLegs,
        combined_odds: roundedCombinedOdds,
        combined_ev: Math.round(avgEV),
        reasoning: gptData.acca_reasoning || '',
        generated_at: new Date().toISOString(),
      }
    })
  } catch (err: any) {
    console.error('Acca builder error:', err)
    return NextResponse.json({ success: false, error: 'Failed to build accumulator' }, { status: 500 })
  }
}
