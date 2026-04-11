import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient as createAdmin } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 30-minute cache now that we have 7,500 req/day
export const revalidate = 1800

function getCurrentSeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 8 ? year : year - 1
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

// Extract odds from Bet365 bookmaker response
function extractOdds(bookmaker: any) {
  if (!bookmaker) return null
  const bets = bookmaker.bets || []

  const mw = bets.find((b: any) => b.id === 1) // Match Winner (1X2)
  const ou = bets.find((b: any) => b.id === 5) // Goals Over/Under
  const btts = bets.find((b: any) => b.id === 8) // Both Teams Score

  const home = parseFloat(mw?.values?.find((v: any) => v.value === 'Home')?.odd || '0')
  const draw = parseFloat(mw?.values?.find((v: any) => v.value === 'Draw')?.odd || '0')
  const away = parseFloat(mw?.values?.find((v: any) => v.value === 'Away')?.odd || '0')
  const over25 = parseFloat(ou?.values?.find((v: any) => v.value === 'Over 2.5')?.odd || '0')
  const bttsYes = parseFloat(btts?.values?.find((v: any) => v.value === 'Yes')?.odd || '0')

  if (!home && !draw && !away) return null
  return { home, draw, away, over25, btts: bttsYes }
}

// Expected Value: (AI_prob × decimal_odds) - 1, expressed as %
// Positive = value bet (AI thinks outcome is more likely than market implies)
function calcEV(aiPct: number, decimalOdds: number): number | null {
  if (!decimalOdds || decimalOdds <= 1) return null
  return Math.round(((aiPct / 100) * decimalOdds - 1) * 100)
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

    // Fetch fixtures + Bet365 odds per league in parallel
    const leagueResults = await Promise.all(
      TOP_LEAGUES.map(async (league) => {
        const [fixtures, oddsData, injuries] = await Promise.all([
          apiFetch(`/fixtures?league=${league.id}&season=${season}&from=${today}&to=${in3days}&status=NS`),
          apiFetch(`/odds?league=${league.id}&season=${season}&date=${today}&bookmaker=1`),
          apiFetch(`/injuries?league=${league.id}&season=${season}&date=${today}`),
        ])

        // Build fixture_id → odds map
        const oddsMap: Record<number, ReturnType<typeof extractOdds>> = {}
        if (oddsData) {
          for (const entry of oddsData) {
            const fid = entry.fixture?.id
            const bk = entry.bookmakers?.[0]
            if (fid && bk) oddsMap[fid] = extractOdds(bk)
          }
        }

        // Build injury lookup: team_id -> injured player names
        const injuryMap: Record<number, string[]> = {}
        if (injuries) {
          for (const inj of injuries) {
            const teamId = inj.team?.id
            const playerName = inj.player?.name
            const reason = inj.player?.reason
            if (teamId && playerName) {
              if (!injuryMap[teamId]) injuryMap[teamId] = []
              injuryMap[teamId].push(`${playerName}${reason ? ` (${reason})` : ''}`)
            }
          }
        }

        return (fixtures || []).slice(0, 2).map((f: any) => ({
          ...f,
          _leagueName: league.name,
          _leagueFlag: league.flag,
          _odds: oddsMap[f.fixture?.id] ?? null,
          _homeInjuries: injuryMap[f.teams?.home?.id] ?? [],
          _awayInjuries: injuryMap[f.teams?.away?.id] ?? [],
        }))
      })
    )

    const allFixtures = leagueResults.flat().slice(0, 20)

    if (allFixtures.length === 0) {
      return NextResponse.json(
        { success: true, predictions: [], message: 'No upcoming fixtures found' },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    // Build prompt including real odds where available
    const fixtureList = allFixtures.map((f: any, i: number) => {
      const home = f.teams?.home?.name
      const away = f.teams?.away?.name
      const date = new Date(f.fixture?.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      const o = f._odds
      const oddsStr = o?.home ? ` | Bet365: H ${o.home} / D ${o.draw} / A ${o.away}` : ''
      const homeInj = f._homeInjuries?.length ? ` | ${home} injuries: ${f._homeInjuries.slice(0, 3).join(', ')}` : ''
      const awayInj = f._awayInjuries?.length ? ` | ${away} injuries: ${f._awayInjuries.slice(0, 3).join(', ')}` : ''
      return `${i + 1}. ${home} vs ${away} | ${f._leagueName} | ${date}${oddsStr}${homeInj}${awayInj}`
    }).join('\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: 'You are an expert football analyst. Generate precise match predictions based on current form, league position, H2H history, and tactical factors. Where Bet365 odds are shown, use them to understand market sentiment. Return valid JSON only.'
      }, {
        role: 'user',
        content: `Generate predictions for these ${season}/${String(season + 1).slice(2)} season matches. Use current form, injuries, suspensions, and H2H. Factor real odds into your confidence levels.

Matches:
${fixtureList}

Return JSON with this exact structure:
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
      "recommended_bet": "Home Win",
      "recommended_odds_range": "1.85-2.10",
      "key_factors": ["5-game home winning run", "Away striker suspended", "H2H: home won 4 of last 5"],
      "risk_level": "Low"
    }
  ]
}`
      }],
      max_tokens: 2500,
    })

    const gptData = JSON.parse(completion.choices[0]?.message?.content || '{"predictions":[]}')
    const gptMap: Record<number, any> = {}
    ;(gptData.predictions || []).forEach((p: any) => { gptMap[p.index] = p })

    // Fetch lineups for today's fixtures (only available ~1hr before kickoff)
    const todayFixtureIds = allFixtures
      .filter((f: any) => f.fixture?.date?.startsWith(today))
      .map((f: any) => f.fixture?.id)
      .filter(Boolean)
      .slice(0, 6) // limit lineup calls

    const lineupMap: Record<number, { home: string[]; away: string[] }> = {}
    await Promise.all(
      todayFixtureIds.map(async (fid: number) => {
        const data = await apiFetch(`/fixtures/lineups?fixture=${fid}`)
        if (data && data.length >= 2) {
          const extract = (team: any) =>
            (team.startXI || []).map((p: any) => `${p.player?.number ?? ''} ${p.player?.name ?? ''}`.trim()).filter(Boolean)
          lineupMap[fid] = { home: extract(data[0]), away: extract(data[1]) }
        }
      })
    )

    // Merge: fixture data + AI predictions + real odds + EV scores
    const predictions = allFixtures.map((f: any, i: number) => {
      const pred = gptMap[i + 1] || {}
      const o = f._odds

      const homeWinPct = pred.home_win_pct ?? 40
      const drawPct = pred.draw_pct ?? 25
      const awayWinPct = pred.away_win_pct ?? 35
      const over25Pct = pred.over_2_5_pct ?? 55
      const bttsPct = pred.btts_pct ?? 50

      // EV per market (null if odds not available)
      const homeEV   = o?.home   ? calcEV(homeWinPct, o.home)   : null
      const drawEV   = o?.draw   ? calcEV(drawPct, o.draw)       : null
      const awayEV   = o?.away   ? calcEV(awayWinPct, o.away)   : null
      const over25EV = o?.over25 ? calcEV(over25Pct, o.over25)  : null
      const bttsEV   = o?.btts   ? calcEV(bttsPct, o.btts)      : null

      // Rank value bets by EV (positive EV only)
      const valueBets = [
        { label: 'Home Win',  ev: homeEV,   odds: o?.home },
        { label: 'Draw',      ev: drawEV,   odds: o?.draw },
        { label: 'Away Win',  ev: awayEV,   odds: o?.away },
        { label: 'Over 2.5',  ev: over25EV, odds: o?.over25 },
        { label: 'BTTS',      ev: bttsEV,   odds: o?.btts },
      ]
        .filter(x => x.ev !== null && x.ev > 0)
        .sort((a, b) => (b.ev ?? 0) - (a.ev ?? 0))

      const bestValue = valueBets[0] ?? null

      return {
        id: f.fixture?.id,
        date: f.fixture?.date,
        league: f._leagueName,
        leagueFlag: f._leagueFlag,
        home_team: f.teams?.home?.name,
        home_logo: f.teams?.home?.logo,
        away_team: f.teams?.away?.name,
        away_logo: f.teams?.away?.logo,
        home_win_pct: homeWinPct,
        draw_pct: drawPct,
        away_win_pct: awayWinPct,
        over_2_5_pct: over25Pct,
        btts_pct: bttsPct,
        confidence: pred.confidence ?? 6,
        recommended_bet: pred.recommended_bet ?? 'No clear value',
        recommended_odds_range: pred.recommended_odds_range ?? '—',
        key_factors: pred.key_factors ?? [],
        risk_level: pred.risk_level ?? 'Medium',
        // Real Bet365 odds
        bookmaker: o ? {
          home: o.home || null,
          draw: o.draw || null,
          away: o.away || null,
          over25: o.over25 || null,
          btts: o.btts || null,
        } : null,
        // Expected value per market
        ev: { home: homeEV, draw: drawEV, away: awayEV, over25: over25EV, btts: bttsEV },
        best_value: bestValue,
        is_value_bet: bestValue !== null && (bestValue.ev ?? 0) >= 5,
        value_score: bestValue?.ev ?? null,
        // Injuries
        home_injuries: f._homeInjuries ?? [],
        away_injuries: f._awayInjuries ?? [],
        // Lineups (if available)
        lineups: lineupMap[f.fixture?.id] ?? null,
      }
    })

    // ── Save predictions to DB for track record ────────────────────────────
    // Use upsert so refreshes don't create duplicates
    try {
      const records = predictions
        .filter(p => p.best_value && p.id)
        .map(p => ({
          fixture_id: p.id,
          home_team: p.home_team,
          away_team: p.away_team,
          league: p.league,
          kick_off: p.date,
          season,
          bet_type: p.best_value!.label,
          prediction: p.best_value!.label.toLowerCase().replace(/ /g, '_'),
          ai_probability: p.home_win_pct, // best approximation
          odds: p.best_value!.odds ?? null,
          ev_percent: p.best_value!.ev ?? null,
          is_value_bet: p.is_value_bet,
        }))

      if (records.length > 0) {
        await supabaseAdmin
          .from('prediction_records')
          .upsert(records, { onConflict: 'fixture_id,prediction', ignoreDuplicates: true })
      }
    } catch (dbErr) {
      // Don't fail the whole response if DB save fails
      console.error('Failed to save predictions to DB:', dbErr)
    }

    return NextResponse.json({ success: true, predictions })
  } catch (err) {
    console.error('Predictions error:', err)
    return NextResponse.json({ success: false, error: 'Failed to generate predictions' }, { status: 500 })
  }
}
