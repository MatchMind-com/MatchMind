/**
 * lib/predictions-quickfetch.ts
 *
 * Fast on-demand fallback for /api/predictions when the daily tier crons
 * haven't populated the cache or all cached picks have already kicked off.
 *
 * Goal: complete in <8s, return ≥5 future picks.
 *
 * Strategy:
 *   - Pull fixtures + odds for ~8 hottest leagues only (top European + UEFA).
 *   - Skip the heavy stuff the main cron does: NO form, NO H2H, NO season
 *     stats, NO injuries, NO standings, NO lineups.
 *   - One batched gpt-4o-mini call covers ALL fixtures at once.
 *   - Same EV math as the main cron so the picks slot into the existing UI
 *     without surprises.
 */
import OpenAI from 'openai'
import { TRACKED_LEAGUES, type TrackedLeague } from './leagues'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

type FetchDiag = { path: string; reason: string; status?: number }

// The "hot 8" — top 5 European leagues + 3 UEFA competitions.
// These are the leagues most users care about and they're guaranteed to
// have rich bookmaker odds, which is the whole point of the fallback.
const HOT_LEAGUE_IDS: readonly number[] = [39, 140, 135, 78, 61, 2, 3, 848] as const

function getCurrentSeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 8 ? year : year - 1
}

function getDatePlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

async function apiFetch(path: string, diag: FetchDiag[]): Promise<any> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      cache: 'no-store',
    })
    if (!res.ok) {
      const reason = res.status === 429 ? 'rate_limited' : `http_${res.status}`
      diag.push({ path, reason, status: res.status })
      return null
    }
    const json = await res.json()
    if (json?.errors && (Array.isArray(json.errors) ? json.errors.length : Object.keys(json.errors).length)) {
      diag.push({ path, reason: `api_error:${JSON.stringify(json.errors)}` })
    }
    return json.response || null
  } catch (e: any) {
    diag.push({ path, reason: `exception:${e.message}` })
    return null
  }
}

function extractOdds(bookmaker: any) {
  if (!bookmaker) return null
  const bets = bookmaker.bets || []
  const mw = bets.find((b: any) => b.id === 1)
  const ou = bets.find((b: any) => b.id === 5)
  const btts = bets.find((b: any) => b.id === 8)
  const home = parseFloat(mw?.values?.find((v: any) => v.value === 'Home')?.odd || '0')
  const draw = parseFloat(mw?.values?.find((v: any) => v.value === 'Draw')?.odd || '0')
  const away = parseFloat(mw?.values?.find((v: any) => v.value === 'Away')?.odd || '0')
  const over25 = parseFloat(ou?.values?.find((v: any) => v.value === 'Over 2.5')?.odd || '0')
  const bttsYes = parseFloat(btts?.values?.find((v: any) => v.value === 'Yes')?.odd || '0')
  if (!home && !draw && !away) return null
  return { home, draw, away, over25, btts: bttsYes }
}

function calcEV(aiPct: number, decimalOdds: number): number | null {
  if (!decimalOdds || decimalOdds <= 1) return null
  return Math.round(((aiPct / 100) * decimalOdds - 1) * 100)
}

export type Prediction = Record<string, any>

/**
 * Quick on-demand prediction fetcher.
 *
 * @param maxLeagues - upper bound on how many of the hot leagues to pull (default 8).
 * @param maxPicks   - upper bound on returned picks (default 12).
 * @returns up to `maxPicks` predictions sorted by value_score desc.
 *
 * Returns whatever it can produce. Caller should treat empty array as a
 * legitimate "no fixtures right now" signal, not an error.
 */
export async function quickFetchPredictions(
  maxLeagues = 8,
  maxPicks = 12
): Promise<Prediction[]> {
  const diag: FetchDiag[] = []
  const season = getCurrentSeason()
  const today = new Date().toISOString().split('T')[0]
  const in3days = getDatePlusDays(3)
  const tomorrow = getDatePlusDays(1)

  const hotLeagueIds = HOT_LEAGUE_IDS.slice(0, maxLeagues)
  const leagueMeta: Record<number, TrackedLeague> = {}
  for (const id of hotLeagueIds) {
    const l = TRACKED_LEAGUES.find(t => t.id === id)
    if (l) leagueMeta[id] = l
  }

  // Fetch fixtures + odds for the top 8 leagues in parallel. ~16 API calls,
  // all kicked off at once — should complete in 1-3s.
  const leagueResults = await Promise.all(
    hotLeagueIds.map(async (leagueId) => {
      const meta = leagueMeta[leagueId]
      if (!meta) return [] as any[]

      const [fixtures, oddsToday, oddsTomorrow] = await Promise.all([
        apiFetch(`/fixtures?league=${leagueId}&season=${season}&from=${today}&to=${in3days}&status=NS`, diag),
        apiFetch(`/odds?league=${leagueId}&season=${season}&date=${today}`, diag),
        apiFetch(`/odds?league=${leagueId}&season=${season}&date=${tomorrow}`, diag),
      ])

      const oddsData = [...(oddsToday || []), ...(oddsTomorrow || [])]
      const oddsMap: Record<number, ReturnType<typeof extractOdds>> = {}
      const oddsBookmakerName: Record<number, string> = {}

      for (const entry of oddsData) {
        const fid = entry.fixture?.id
        if (!fid) continue
        const bookmakers: any[] = entry.bookmakers || []
        const bet365Raw = bookmakers.find((b: any) => b.id === 1)
        const pinnacleRaw = bookmakers.find((b: any) => b.id === 29)
        const anyRaw = bookmakers[0]
        const chosen = bet365Raw || pinnacleRaw || anyRaw
        if (chosen) {
          oddsMap[fid] = extractOdds(chosen)
          oddsBookmakerName[fid] = chosen.name || 'Live'
        }
      }

      // Take the top 3 fixtures per league with odds — the rest get pruned
      // by the round-robin below anyway, no need to ship them to GPT.
      return (fixtures || [])
        .filter((f: any) => oddsMap[f.fixture?.id])
        .slice(0, 3)
        .map((f: any) => ({
          ...f,
          _leagueName: meta.name,
          _leagueFlag: meta.flag,
          _leagueId: leagueId,
          _odds: oddsMap[f.fixture?.id] ?? null,
          _oddsBookmaker: oddsBookmakerName[f.fixture?.id] ?? null,
        }))
    })
  )

  // Round-robin so every league gets one pick before any league gets two.
  const perLeague: any[][] = leagueResults
  const allFixtures: any[] = []
  let round = 0
  const cap = Math.max(maxPicks, 16)
  while (allFixtures.length < cap) {
    let added = 0
    for (const league of perLeague) {
      if (round < league.length) {
        allFixtures.push(league[round])
        added++
        if (allFixtures.length >= cap) break
      }
    }
    if (added === 0) break
    round++
  }

  if (allFixtures.length === 0) return []

  // Filter to future kickoffs only — there's no point asking GPT to predict
  // a match that's already started.
  const nowMs = Date.now()
  const futureFixtures = allFixtures.filter((f: any) => {
    const t = new Date(f.fixture?.date).getTime()
    return Number.isFinite(t) && t > nowMs
  })

  if (futureFixtures.length === 0) return []

  // Build a compact prompt — odds-only context, no form/H2H/stats.
  const impliedProb = (odds: number | null | undefined) => odds && odds > 1 ? Math.round(100 / odds) : null
  const fixtureList = futureFixtures.map((f: any, i: number) => {
    const home = f.teams?.home?.name
    const away = f.teams?.away?.name
    const date = new Date(f.fixture?.date).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
    const o = f._odds
    const oddsStr = o?.home
      ? ` | odds: H ${o.home} (${impliedProb(o.home)}%) / D ${o.draw} (${impliedProb(o.draw)}%) / A ${o.away} (${impliedProb(o.away)}%)`
      : ''
    return `${i + 1}. ${home} vs ${away} | ${f._leagueName} | ${date}${oddsStr}`
  }).join('\n')

  let gptMap: Record<number, any> = {}
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      seed: 42,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: `You are a calibrated football betting analyst. Output probability estimates close to the implied market probabilities (derived from the odds). The market is usually within 2-5 percentage points of true probability. Your home_win_pct + draw_pct + away_win_pct must sum to 100-108. Stay within ±8 points of the implied probabilities unless you have a specific concrete reason. Return valid JSON only.`,
      }, {
        role: 'user',
        content: `Generate calibrated predictions for these matches. Implied probabilities derived from bookmaker odds are shown.

Matches:
${fixtureList}

Return JSON:
{
  "predictions": [
    {
      "index": 1,
      "home_win_pct": 50,
      "draw_pct": 28,
      "away_win_pct": 22,
      "over_2_5_pct": 60,
      "btts_pct": 55,
      "confidence": 7,
      "recommended_bet": "Home Win",
      "recommended_odds_range": "1.85-2.10",
      "key_factors": ["Market favors home side"],
      "risk_level": "Medium",
      "edge_explanation": "Brief plain-English reason."
    }
  ]
}`,
      }],
      max_tokens: 4000,
    })
    const gptData = JSON.parse(completion.choices[0]?.message?.content || '{"predictions":[]}')
    ;(gptData.predictions || []).forEach((p: any) => { gptMap[p.index] = p })
  } catch (gptErr) {
    console.error('[quickfetch] GPT call failed:', gptErr)
    // Empty gptMap → all predictions get the default neutral values below.
  }

  const MAX_REAL_EV = 25
  const MAX_REAL_ODDS = 4.0

  const predictions: Prediction[] = futureFixtures.map((f: any, i: number) => {
    const pred = gptMap[i + 1] || {}
    const o = f._odds

    const homeWinPct = pred.home_win_pct ?? 40
    const drawPct = pred.draw_pct ?? 25
    const awayWinPct = pred.away_win_pct ?? 35
    const over25Pct = pred.over_2_5_pct ?? 55
    const bttsPct = pred.btts_pct ?? 50

    const homeEV   = o?.home   ? calcEV(homeWinPct, o.home)   : null
    const drawEV   = o?.draw   ? calcEV(drawPct, o.draw)       : null
    const awayEV   = o?.away   ? calcEV(awayWinPct, o.away)   : null
    const over25EV = o?.over25 ? calcEV(over25Pct, o.over25)  : null
    const bttsEV   = o?.btts   ? calcEV(bttsPct, o.btts)      : null

    const valueBets = [
      { label: 'Home Win',  ev: homeEV,   odds: o?.home,   aiPct: homeWinPct },
      { label: 'Away Win',  ev: awayEV,   odds: o?.away,   aiPct: awayWinPct },
      { label: 'Over 2.5',  ev: over25EV, odds: o?.over25, aiPct: over25Pct },
      { label: 'BTTS',      ev: bttsEV,   odds: o?.btts,   aiPct: bttsPct },
    ]
      .filter(x => x.ev !== null && x.ev > 0 && x.ev <= MAX_REAL_EV)
      .filter(x => !x.odds || x.odds <= MAX_REAL_ODDS)
      .sort((a, b) => (b.ev ?? 0) - (a.ev ?? 0))

    const bestValue = valueBets[0] ?? null

    return {
      id: f.fixture?.id,
      _leagueId: f._leagueId,
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
      edge_explanation: pred.edge_explanation ?? null,
      bookmaker: o ? {
        home: o.home || null,
        draw: o.draw || null,
        away: o.away || null,
        over25: o.over25 || null,
        btts: o.btts || null,
      } : null,
      bookmaker_name: f._oddsBookmaker ?? null,
      ev: { home: homeEV, draw: drawEV, away: awayEV, over25: over25EV, btts: bttsEV },
      best_value: bestValue,
      pinnacle_edge: null,
      is_value_bet: bestValue !== null && (bestValue.ev ?? 0) >= 5,
      value_score: bestValue?.ev ?? null,
      // Quickfetch skips these — daily cron will fill them in on the next run.
      home_injuries: [],
      away_injuries: [],
      lineups: null,
      home_stats: null,
      away_stats: null,
      _quickfetch: true,
    }
  })

  // Sort by value_score desc so the strongest picks float to the top.
  predictions.sort((a, b) => (b.value_score ?? -999) - (a.value_score ?? -999))

  return predictions.slice(0, maxPicks)
}
