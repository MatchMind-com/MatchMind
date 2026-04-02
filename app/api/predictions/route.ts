import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

// Cache predictions for 6 hours
export const revalidate = 21600

// Returns the current football season year (e.g. April 2026 → 2025 for 2025/26 season)
function getCurrentSeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 8 ? year : year - 1
}

async function apiFetch(path: string) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 21600 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.response || null
  } catch { return null }
}

function getDatePlusDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const TOP_LEAGUES = [
  { id: 39,  name: 'Premier League',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, name: 'La Liga',           flag: '🇪🇸' },
  { id: 135, name: 'Serie A',           flag: '🇮🇹' },
  { id: 78,  name: 'Bundesliga',        flag: '🇩🇪' },
  { id: 61,  name: 'Ligue 1',          flag: '🇫🇷' },
  { id: 2,   name: 'Champions League',  flag: '🏆' },
  { id: 3,   name: 'Europa League',     flag: '🥈' },
  { id: 848, name: 'Conference League', flag: '🥉' },
  { id: 88,  name: 'Eredivisie',        flag: '🇳🇱' },
  { id: 94,  name: 'Primeira Liga',     flag: '🇵🇹' },
]

export async function GET() {
  try {
    const season = getCurrentSeason()
    const today = new Date().toISOString().split('T')[0]
    const in3days = getDatePlusDays(3)

    // Fetch fixtures from all top leagues in parallel
    const fixtureGroups = await Promise.all(
      TOP_LEAGUES.map(async (league) => {
        const data = await apiFetch(
          `/fixtures?league=${league.id}&season=${season}&from=${today}&to=${in3days}&status=NS`
        )
        return (data || []).slice(0, 2).map((f: Record<string, unknown>) => ({
          ...f,
          _leagueName: league.name,
          _leagueFlag: league.flag,
        }))
      })
    )

    const allFixtures = fixtureGroups.flat().slice(0, 20)

    if (allFixtures.length === 0) {
      return NextResponse.json({ success: true, predictions: [], message: 'No upcoming fixtures found' })
    }

    // Build fixture list for GPT
    const fixtureList = allFixtures.map((f: Record<string, unknown>, i: number) => {
      const fixture = f.fixture as Record<string, unknown>
      const teams = f.teams as Record<string, unknown>
      const home = teams?.home as Record<string, unknown>
      const away = teams?.away as Record<string, unknown>
      const leagueData = f.league as Record<string, unknown>
      const dateStr = fixture?.date as string
      const date = dateStr ? new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'TBD'
      return `${i + 1}. ${home?.name} vs ${away?.name} | ${f._leagueName} | ${date}`
    }).join('\n')

    // Single GPT call for all predictions
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: 'You are an expert football analyst. Generate match predictions based on current form, league position, historical H2H, and tactical factors. Return valid JSON only.'
      }, {
        role: 'user',
        content: `Generate AI predictions for these upcoming matches. Use your knowledge of current ${season}/${String(season + 1).slice(2)} season form, recent results, key injuries, and head-to-head records.

Matches:
${fixtureList}

Return JSON:
{
  "predictions": [
    {
      "index": 1,
      "home_win_pct": 55,
      "draw_pct": 25,
      "away_win_pct": 20,
      "over_2_5_pct": 65,
      "btts_pct": 55,
      "confidence": 8,
      "recommended_bet": "Home Win or Draw",
      "recommended_odds_range": "1.4-1.8",
      "key_factors": ["Home team on 5-game winning run", "Away striker injured", "H2H favours home side 4-1 last 5"],
      "risk_level": "Low"
    }
  ]
}`
      }],
      max_tokens: 2000,
    })

    const gptData = JSON.parse(completion.choices[0]?.message?.content || '{"predictions":[]}')
    const gptPredictions: Record<number, Record<string, unknown>> = {}
    ;(gptData.predictions || []).forEach((p: Record<string, unknown>) => {
      gptPredictions[p.index as number] = p
    })

    // Merge fixtures with predictions
    const predictions = allFixtures.map((f: Record<string, unknown>, i: number) => {
      const fixture = f.fixture as Record<string, unknown>
      const teams = f.teams as Record<string, unknown>
      const home = teams?.home as Record<string, unknown>
      const away = teams?.away as Record<string, unknown>
      const dateStr = fixture?.date as string
      const pred = gptPredictions[i + 1] || {}
      return {
        id: fixture?.id,
        date: dateStr,
        league: f._leagueName,
        leagueFlag: f._leagueFlag,
        home_team: home?.name,
        home_logo: home?.logo,
        away_team: away?.name,
        away_logo: away?.logo,
        home_win_pct: pred.home_win_pct ?? 40,
        draw_pct: pred.draw_pct ?? 25,
        away_win_pct: pred.away_win_pct ?? 35,
        over_2_5_pct: pred.over_2_5_pct ?? 55,
        btts_pct: pred.btts_pct ?? 50,
        confidence: pred.confidence ?? 6,
        recommended_bet: pred.recommended_bet ?? 'No clear value',
        recommended_odds_range: pred.recommended_odds_range ?? '—',
        key_factors: pred.key_factors ?? [],
        risk_level: pred.risk_level ?? 'Medium',
      }
    })

    return NextResponse.json({ success: true, predictions })
  } catch (err) {
    console.error('Predictions error:', err)
    return NextResponse.json({ success: false, error: 'Failed to generate predictions' }, { status: 500 })
  }
}
