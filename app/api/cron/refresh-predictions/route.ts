/**
 * /api/cron/refresh-predictions
 *
 * Heavy cron that runs the full predictions pipeline (API-Football + GPT-4o)
 * and writes the result to the predictions_by_league table (one row per league)
 * AND keeps the legacy single-row predictions_cache up to date for backwards compat.
 *
 * The public /api/predictions route reads from these tables — no computation there.
 *
 * Tiering: accepts ?tier=1|2|3|all to refresh a subset of the 50 tracked leagues.
 * Three Vercel crons (refresh-predictions-tier1/2/3) each call this with their tier
 * so a single 60s budget never has to cover all 50 leagues.
 *
 * NOTE: The Mac LaunchAgent at ~/Library/LaunchAgents/com.matchmind.seed-predictions.plist
 * can call this with ?tier=all to refresh every tracked league at once (no Vercel timeout locally).
 *
 * Auth: Vercel cron (x-vercel-cron: 1) OR Bearer ${CRON_SECRET}
 */

import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { allLeagues, leaguesByTier, getSeasonForLeague, findLeague, type TrackedLeague } from '@/lib/leagues'

export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type FetchDiag = { path: string; reason: string; status?: number }
// League shape now lives in lib/leagues.ts as TrackedLeague (single source
// of truth for the 50 competitions MatchMind covers).
type League = TrackedLeague

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

async function apiFetch(path: string, diag: FetchDiag[]) {
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

async function batchedAll<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  interBatchDelayMs: number = 0
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
    if (interBatchDelayMs > 0 && i + concurrency < items.length) {
      await new Promise(r => setTimeout(r, interBatchDelayMs))
    }
  }
  return results
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

type OddsShape = { home: number; draw: number; away: number; over25: number; btts: number } | null
function calcPinnacleEdge(
  pinnacle: OddsShape,
  bet365: OddsShape
): { market: string; edge_pct: number; pinnacle_odds: number; bet365_odds: number } | null {
  if (!pinnacle || !bet365) return null
  const markets = [
    { key: 'home' as const, label: 'Home Win' },
    { key: 'draw' as const, label: 'Draw' },
    { key: 'away' as const, label: 'Away Win' },
    { key: 'over25' as const, label: 'Over 2.5' },
    { key: 'btts' as const, label: 'BTTS' },
  ]
  let best: { market: string; edge_pct: number; pinnacle_odds: number; bet365_odds: number } | null = null
  for (const { key, label } of markets) {
    const pOdds = pinnacle[key]
    const bOdds = bet365[key]
    if (!pOdds || !bOdds || pOdds <= 1 || bOdds <= 1) continue
    const edge = (1 / pOdds - 1 / bOdds) * 100
    const edgeRounded = Math.round(edge * 10) / 10
    if (edgeRounded >= 2 && (!best || edgeRounded > best.edge_pct)) {
      best = { market: label, edge_pct: edgeRounded, pinnacle_odds: pOdds, bet365_odds: bOdds }
    }
  }
  return best
}

function formatForm(fixtures: any[], teamId: number): string {
  if (!fixtures?.length) return 'No data'
  return fixtures.slice(0, 5).map((f: any) => {
    const isHome = f.teams?.home?.id === teamId
    const homeGoals = f.goals?.home ?? 0
    const awayGoals = f.goals?.away ?? 0
    const scored = isHome ? homeGoals : awayGoals
    const conceded = isHome ? awayGoals : homeGoals
    const opponent = isHome ? f.teams?.away?.name : f.teams?.home?.name
    const venue = isHome ? 'H' : 'A'
    let result = 'D'
    if (scored > conceded) result = 'W'
    else if (scored < conceded) result = 'L'
    return `${result} ${scored}-${conceded} vs ${opponent} (${venue})`
  }).join(' | ')
}

function extractTeamStats(stats: any, position: number | null) {
  if (!stats) return null
  const fx = stats.fixtures || {}
  const goals = stats.goals || {}
  const played = fx.played?.total || 0
  const wins = fx.wins?.total || 0
  const draws = fx.draws?.total || 0
  const losses = fx.loses?.total || 0
  const goalsFor = goals.for?.total?.total || 0
  const goalsAgainst = goals.against?.total?.total || 0
  const cleanSheets = stats.clean_sheet?.total || 0
  const failedToScore = stats.failed_to_score?.total || 0
  return {
    played, wins, draws, losses,
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    goals_per_game: played > 0 ? Math.round((goalsFor / played) * 10) / 10 : 0,
    conceded_per_game: played > 0 ? Math.round((goalsAgainst / played) * 10) / 10 : 0,
    clean_sheets: cleanSheets,
    clean_sheet_pct: played > 0 ? Math.round((cleanSheets / played) * 100) : 0,
    failed_to_score: failedToScore,
    league_position: position,
    home: { wins: fx.wins?.home || 0, draws: fx.draws?.home || 0, losses: fx.loses?.home || 0 },
    away: { wins: fx.wins?.away || 0, draws: fx.draws?.away || 0, losses: fx.loses?.away || 0 },
    biggest_win: stats.biggest?.wins?.home ?? stats.biggest?.wins?.away ?? null,
    form: stats.form ?? null,
  }
}

function formatH2H(fixtures: any[]): string {
  if (!fixtures?.length) return 'No H2H data'
  return fixtures.slice(0, 5).map((f: any) => {
    const homeGoals = f.goals?.home ?? '?'
    const awayGoals = f.goals?.away ?? '?'
    return `${f.teams?.home?.name} ${homeGoals}-${awayGoals} ${f.teams?.away?.name}`
  }).join(' | ')
}

// All league lists come from lib/leagues.ts — keeps the AI prompt block,
// the cron picker, and the per-tier wrappers in lockstep.
function pickLeagues(tier: string): League[] {
  switch (tier) {
    case '1': return leaguesByTier(1)
    case '2': return leaguesByTier(2)
    case '3': return leaguesByTier(3)
    case 'all': return allLeagues()
    default: return leaguesByTier(1)
  }
}

/**
 * Core refresh: fetches fixtures + odds + form + stats for the given leagues,
 * runs GPT-4o, and returns predictions grouped by league_id.
 */
async function refreshLeagues(
  leagues: League[],
  diag: FetchDiag[]
): Promise<{ predictionsByLeague: Record<number, any[]>; totalFixtures: number; allPredictions: any[] }> {
  const today = new Date().toISOString().split('T')[0]
  // Look 7 days out (was 4) so off-peak leagues like Saudi/J1/MLS surface
  // upcoming weekend matches even when the cron runs early in the week.
  const in3days = getDatePlusDays(7)
  const tomorrow = getDatePlusDays(1)

  const leagueResults = await batchedAll(
    leagues,
    3,
    async (league) => {
      // Per-league season: European leagues = Aug-May start year, calendar
      // leagues (Friendlies, WC, MLS, Brasileirão, etc) = current year.
      // Before this, a single season=getCurrentSeason() was used for ALL
      // leagues, returning 0 fixtures for tournaments/calendar leagues in
      // every Jan-Jul window. Cause of the 20-day-stale cache before WC.
      const season = getSeasonForLeague(league)
      const [fixtures, oddsToday, oddsTomorrow, injuries, standings] = await Promise.all([
        apiFetch(`/fixtures?league=${league.id}&season=${season}&from=${today}&to=${in3days}&status=NS`, diag),
        apiFetch(`/odds?league=${league.id}&season=${season}&date=${today}`, diag),
        apiFetch(`/odds?league=${league.id}&season=${season}&date=${tomorrow}`, diag),
        apiFetch(`/injuries?league=${league.id}&season=${season}&date=${today}`, diag),
        apiFetch(`/standings?league=${league.id}&season=${season}`, diag),
      ])

      const standingMap: Record<number, number> = {}
      const rawStandings = standings?.[0]?.league?.standings?.[0] ?? standings?.[0]?.league?.standings?.flat?.() ?? []
      for (const s of rawStandings) {
        if (s?.team?.id) standingMap[s.team.id] = s.rank
      }

      const oddsData = [...(oddsToday || []), ...(oddsTomorrow || [])]
      const oddsMap: Record<number, ReturnType<typeof extractOdds>> = {}
      const pinnacleMap: Record<number, ReturnType<typeof extractOdds>> = {}
      const oddsBookmakerName: Record<number, string> = {}

      for (const entry of oddsData) {
        const fid = entry.fixture?.id
        if (!fid) continue
        const bookmakers: any[] = entry.bookmakers || []
        const pinnacleRaw = bookmakers.find((b: any) => b.id === 29)
        if (pinnacleRaw) pinnacleMap[fid] = extractOdds(pinnacleRaw)
        const bet365Raw = bookmakers.find((b: any) => b.id === 1)
        const anyRaw = bookmakers[0]
        const chosen = bet365Raw || pinnacleRaw || anyRaw
        if (chosen) {
          oddsMap[fid] = extractOdds(chosen)
          oddsBookmakerName[fid] = chosen.name || 'Live'
        }
      }

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

      // Prioritise fixtures that bookmakers actually priced — those are
      // the matches with public interest and real edge potential. Friendlies
      // are the worst offender for this: API returns 60+ matches alphabetically
      // starting with weird minnow tie-ups (Philippines v Guam, Gibraltar
      // v British Virgin Islands), which is what the cron picked before
      // when it just sliced the first 4. Fixtures-with-odds first, then
      // fixtures-without if we still need padding.
      const allFixturesForLeague = (fixtures || []) as any[]
      const withOdds = allFixturesForLeague.filter((f: any) => oddsMap[f.fixture?.id])
      const withoutOdds = allFixturesForLeague.filter((f: any) => !oddsMap[f.fixture?.id])
      // Cap higher for Friendlies (id=10) — pre-WC week has 100+ fixtures,
      // 8 picks lets the most popular tune-ups surface. Other leagues stay
      // at 4 since they rarely have more than a matchday's worth in window.
      const perLeagueCap = league.id === 10 ? 8 : 4
      const orderedFixtures = [...withOdds, ...withoutOdds].slice(0, perLeagueCap)

      return orderedFixtures.map((f: any) => ({
        ...f,
        _leagueName: league.name,
        _leagueFlag: league.flag,
        _leagueId: league.id,
        _odds: oddsMap[f.fixture?.id] ?? null,
        _pinnacleOdds: pinnacleMap[f.fixture?.id] ?? null,
        _oddsBookmaker: oddsBookmakerName[f.fixture?.id] ?? null,
        _homeInjuries: injuryMap[f.teams?.home?.id] ?? [],
        _awayInjuries: injuryMap[f.teams?.away?.id] ?? [],
        _homePosition: standingMap[f.teams?.home?.id] ?? null,
        _awayPosition: standingMap[f.teams?.away?.id] ?? null,
      }))
    },
    800
  )

  function roundRobinPick<T>(perLeague: T[][], cap: number): T[] {
    const picked: T[] = []
    let round = 0
    while (picked.length < cap) {
      let added = 0
      for (const league of perLeague) {
        if (round < league.length) {
          picked.push(league[round])
          added++
          if (picked.length >= cap) break
        }
      }
      if (added === 0) break
      round++
    }
    return picked
  }

  // Cap proportional to tier size: keep ~2 per league as headroom
  const cap = Math.max(8, leagues.length * 2)
  const allFixtures = roundRobinPick(leagueResults, cap)

  if (allFixtures.length === 0) {
    return { predictionsByLeague: {}, totalFixtures: 0, allPredictions: [] }
  }

  const formData = await batchedAll(
    allFixtures,
    4,
    async (f: any) => {
      const homeId = f.teams?.home?.id
      const awayId = f.teams?.away?.id
      const leagueId = f._leagueId
      if (!homeId || !awayId) return { homeId: null, awayId: null, homeForm: null, awayForm: null, h2h: null, homeStats: null, awayStats: null }
      // Per-league season again — same bug applied here too. If a friendly
      // gets through the fixtures fetch but team stats use season=2025
      // for a calendar league, the stats return empty and the GPT prompt
      // gets degraded.
      const leagueMeta = findLeague(leagueId)
      const season = leagueMeta ? getSeasonForLeague(leagueMeta) : new Date().getFullYear()
      const [homeForm, awayForm, h2h, homeStatsRaw, awayStatsRaw] = await Promise.all([
        apiFetch(`/fixtures?team=${homeId}&last=5`, diag),
        apiFetch(`/fixtures?team=${awayId}&last=5`, diag),
        apiFetch(`/fixtures/headtohead?h2h=${homeId}-${awayId}&last=5`, diag),
        apiFetch(`/teams/statistics?league=${leagueId}&season=${season}&team=${homeId}`, diag),
        apiFetch(`/teams/statistics?league=${leagueId}&season=${season}&team=${awayId}`, diag),
      ])
      return {
        homeId,
        awayId,
        homeForm,
        awayForm,
        h2h,
        homeStats: extractTeamStats(homeStatsRaw, f._homePosition),
        awayStats: extractTeamStats(awayStatsRaw, f._awayPosition),
      }
    },
    400
  )

  const impliedProb = (odds: number | null | undefined) => odds && odds > 1 ? Math.round(100 / odds) : null
  const fixtureList = allFixtures.map((f: any, i: number) => {
    const home = f.teams?.home?.name
    const away = f.teams?.away?.name
    const date = new Date(f.fixture?.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    const o = f._odds
    const oddsStr = o?.home
      ? ` | Bet365 odds: H ${o.home} (${impliedProb(o.home)}% implied) / D ${o.draw} (${impliedProb(o.draw)}% implied) / A ${o.away} (${impliedProb(o.away)}% implied)`
      : ''
    const homeInj = f._homeInjuries?.length ? `\n   ${home} injuries: ${f._homeInjuries.slice(0, 3).join(', ')}` : ''
    const awayInj = f._awayInjuries?.length ? `\n   ${away} injuries: ${f._awayInjuries.slice(0, 3).join(', ')}` : ''
    const fd = formData[i]
    const homeFormStr = fd?.homeForm ? `\n   ${home} last 5: ${formatForm(fd.homeForm, fd.homeId)}` : ''
    const awayFormStr = fd?.awayForm ? `\n   ${away} last 5: ${formatForm(fd.awayForm, fd.awayId)}` : ''
    const h2hStr = fd?.h2h?.length ? `\n   H2H: ${formatH2H(fd.h2h)}` : ''
    const hs = fd?.homeStats
    const as_ = fd?.awayStats
    const homeStatsStr = hs ? `\n   ${home} season: ${hs.league_position ? `#${hs.league_position} ` : ''}${hs.wins}W/${hs.draws}D/${hs.losses}L | ${hs.goals_per_game} g/game | ${hs.conceded_per_game} conceded/game | ${hs.clean_sheet_pct}% clean sheets` : ''
    const awayStatsStr = as_ ? `\n   ${away} season: ${as_.league_position ? `#${as_.league_position} ` : ''}${as_.wins}W/${as_.draws}D/${as_.losses}L | ${as_.goals_per_game} g/game | ${as_.conceded_per_game} conceded/game | ${as_.clean_sheet_pct}% clean sheets` : ''
    return `${i + 1}. ${home} vs ${away} | ${f._leagueName} | ${date}${oddsStr}${homeInj}${awayInj}${homeFormStr}${awayFormStr}${h2hStr}${homeStatsStr}${awayStatsStr}`
  }).join('\n\n')

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0,
    seed: 42,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'system',
      content: `You are a calibrated football betting analyst. You must output probability estimates that are CLOSE to the implied market probabilities (derived from Bet365 odds), not aspirational guesses.

CALIBRATION RULES — these are absolute:
1. The Bet365 odds encode years of expert modelling and sharp money. The market is usually within 2-5 percentage points of true probability.
2. Your home_win_pct / draw_pct / away_win_pct MUST sum to between 100 and 108 (slight overround is fine).
3. Your probabilities MUST be within ±8 percentage points of the implied market probabilities UNLESS you have a specific, concrete reason (e.g., a key striker injured, a manager just fired, team playing in a dead rubber). State that reason explicitly in key_factors.
4. Do NOT inflate underdog probabilities. If the market prices away win at 6.40 (≈16% implied), your away_win_pct should be 14-22% at most, not 35%+.
5. A real value bet edge is typically 2-8%. EV above +20% is almost always a calibration error, not a real opportunity.

Return valid JSON only.`
    }, {
      role: 'user',
      content: `Generate CALIBRATED predictions for the matches below. Real form data, H2H, injuries, and Bet365 odds (with implied probabilities) are provided.

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
      "key_factors": ["5-game home winning run", "Away striker suspended"],
      "risk_level": "Low",
      "edge_explanation": "2-sentence plain-English explanation of WHY this bet has mathematical edge."
    }
  ]
}`
    }],
    max_tokens: 8000,
  })

  const gptData = JSON.parse(completion.choices[0]?.message?.content || '{"predictions":[]}')
  const gptMap: Record<number, any> = {}
  ;(gptData.predictions || []).forEach((p: any) => { gptMap[p.index] = p })

  const todayFixtureIds = allFixtures
    .filter((f: any) => f.fixture?.date?.startsWith(today))
    .map((f: any) => f.fixture?.id)
    .filter(Boolean)
    .slice(0, 6)

  const lineupMap: Record<number, { home: string[]; away: string[] }> = {}
  await Promise.all(
    todayFixtureIds.map(async (fid: number) => {
      const data = await apiFetch(`/fixtures/lineups?fixture=${fid}`, diag)
      if (data && data.length >= 2) {
        const extract = (team: any) =>
          (team.startXI || []).map((p: any) => `${p.player?.number ?? ''} ${p.player?.name ?? ''}`.trim()).filter(Boolean)
        lineupMap[fid] = { home: extract(data[0]), away: extract(data[1]) }
      }
    })
  )

  const predictions = allFixtures.map((f: any, i: number) => {
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

    const MAX_REAL_EV = 25
    const MAX_REAL_ODDS = 4.0
    const valueBets = [
      { label: 'Home Win',  ev: homeEV,   odds: o?.home,   aiPct: homeWinPct },
      { label: 'Draw',      ev: drawEV,   odds: o?.draw,   aiPct: drawPct },
      { label: 'Away Win',  ev: awayEV,   odds: o?.away,   aiPct: awayWinPct },
      { label: 'Over 2.5',  ev: over25EV, odds: o?.over25, aiPct: over25Pct },
      { label: 'BTTS',      ev: bttsEV,   odds: o?.btts,   aiPct: bttsPct },
    ]
      .filter(x => x.ev !== null && x.ev > 0 && x.ev <= MAX_REAL_EV)
      .filter(x => !x.odds || x.odds <= MAX_REAL_ODDS)
      .sort((a, b) => (b.ev ?? 0) - (a.ev ?? 0))

    const bestValue = valueBets[0] ?? null
    const pinnacleEdge = calcPinnacleEdge(f._pinnacleOdds ?? null, o ?? null)

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
      pinnacle_edge: pinnacleEdge,
      // Lowered from >=5 to >=2 so EV 2-4% picks count too. The daily plan
      // route still tags edge_strength so the UI can communicate that thin
      // edges are thin — but we no longer hide them from the consumer.
      is_value_bet: (bestValue !== null && (bestValue.ev ?? 0) >= 2) || pinnacleEdge !== null,
      value_score: pinnacleEdge?.edge_pct ?? bestValue?.ev ?? null,
      home_injuries: f._homeInjuries ?? [],
      away_injuries: f._awayInjuries ?? [],
      lineups: lineupMap[f.fixture?.id] ?? null,
      home_stats: formData[i]?.homeStats ?? null,
      away_stats: formData[i]?.awayStats ?? null,
    }
  })

  // Group by league_id
  const predictionsByLeague: Record<number, any[]> = {}
  for (const p of predictions) {
    const lid = p._leagueId
    if (!lid) continue
    if (!predictionsByLeague[lid]) predictionsByLeague[lid] = []
    predictionsByLeague[lid].push(p)
  }

  // Save individual picks for track record
  try {
    const records = predictions
      .filter(p => p.best_value && p.id)
      .map(p => {
        // Derive season per-pick from its league (was a single global var
        // before the per-league season fix). For unknown leagues fall back
        // to the calendar year as a safe default.
        const leagueMetaForRec = findLeague(p._leagueId)
        const pickSeason = leagueMetaForRec ? getSeasonForLeague(leagueMetaForRec) : new Date().getFullYear()
        return {
        fixture_id: p.id,
        home_team: p.home_team,
        away_team: p.away_team,
        league: p.league,
        kick_off: p.date,
        season: pickSeason,
        bet_type: p.best_value!.label,
        prediction: p.best_value!.label.toLowerCase().replace(/ /g, '_'),
        ai_probability: (p.best_value as any).aiPct ?? null,
        odds: p.best_value!.odds ?? null,
        ev_percent: p.best_value!.ev ?? null,
        is_value_bet: p.is_value_bet,
        }
      })
    if (records.length > 0) {
      await supabaseAdmin
        .from('prediction_records')
        .upsert(records, { onConflict: 'fixture_id,prediction', ignoreDuplicates: true })
    }
  } catch (dbErr) {
    console.error('[refresh-predictions] DB save error:', dbErr)
  }

  return { predictionsByLeague, totalFixtures: allFixtures.length, allPredictions: predictions }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const tier = url.searchParams.get('tier') ?? '1'
  const leagues = pickLeagues(tier)

  const start = Date.now()
  const diag: FetchDiag[] = []

  try {
    const { predictionsByLeague, totalFixtures, allPredictions } = await refreshLeagues(leagues, diag)

    if (totalFixtures === 0) {
      return NextResponse.json({ success: true, message: 'No fixtures for this tier', tier, duration_ms: Date.now() - start })
    }

    // Per-league upserts
    const leagueMeta: Record<number, League> = {}
    for (const l of leagues) leagueMeta[l.id] = l

    for (const [leagueIdStr, preds] of Object.entries(predictionsByLeague)) {
      const leagueId = parseInt(leagueIdStr, 10)
      const meta = leagueMeta[leagueId]
      if (!meta) continue
      try {
        await supabaseAdmin.from('predictions_by_league').upsert({
          league_id: leagueId,
          league_name: meta.name,
          league_flag: meta.flag,
          payload: preds,
          generated_at: new Date().toISOString(),
          fixture_count: preds.length,
          api_failures: diag.filter(d => d.path.includes(`league=${leagueId}`)).length,
        }, { onConflict: 'league_id' })
      } catch (dbErr) {
        console.error(`[refresh-predictions] per-league upsert failed for ${leagueId}:`, dbErr)
      }
    }

    // Legacy single-row cache: rebuild from ALL latest per-league rows so
    // tier1/2/3 runs each keep the legacy reader complete during transition.
    try {
      const { data: allLeagueRows } = await supabaseAdmin
        .from('predictions_by_league')
        .select('league_id, league_name, payload, generated_at')
        .order('generated_at', { ascending: false })

      const merged: any[] = []
      const leagueNames: string[] = []
      let oldest: string | null = null
      for (const row of allLeagueRows || []) {
        const arr = (row.payload as any[]) || []
        merged.push(...arr)
        leagueNames.push(row.league_name)
        if (!oldest || row.generated_at < oldest) oldest = row.generated_at
      }

      const legacyMeta = {
        leagues_attempted: allLeagues().length,
        leagues_with_fixtures: leagueNames.length,
        fixture_count: merged.length,
        league_names: leagueNames,
        api_failures: diag.length,
        api_failure_sample: diag.slice(0, 10),
        generated_at: new Date().toISOString(),
        oldest_refresh: oldest,
        last_tier_refreshed: tier,
        duration_ms: Date.now() - start,
      }

      await supabaseAdmin.from('predictions_cache').upsert({
        id: 1,
        payload: { success: true, predictions: merged, meta: legacyMeta },
        generated_at: new Date().toISOString(),
        fixture_count: merged.length,
        leagues_count: leagueNames.length,
      }, { onConflict: 'id' })
    } catch (dbErr) {
      console.error('[refresh-predictions] legacy cache update failed:', dbErr)
    }

    const leaguesWithFixtures = Object.keys(predictionsByLeague).length
    console.log(`[refresh-predictions] Tier ${tier} done: ${allPredictions.length} predictions across ${leaguesWithFixtures} leagues, ${diag.length} failures, ${Date.now() - start}ms`)

    return NextResponse.json({
      success: true,
      tier,
      predictions_count: allPredictions.length,
      leagues_with_fixtures: leaguesWithFixtures,
      api_failures: diag.length,
      duration_ms: Date.now() - start,
    })
  } catch (err: any) {
    console.error('[refresh-predictions] Fatal error:', err)
    return NextResponse.json({ success: false, error: err.message, tier, duration_ms: Date.now() - start }, { status: 500 })
  }
}
