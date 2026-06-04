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

// 300s = max for Vercel Pro tier. With 22-market evaluation per fixture
// (9 GPT-predicted probs + 13 derived) × up to 90 fixtures per tier 3
// run, plus form/H2H/stats fetches, the full pipeline can take 80-120s.
// 60s was timing out (504 FUNCTION_INVOCATION_TIMEOUT) and not writing
// anything to cache. 300s leaves comfortable headroom.
export const maxDuration = 300

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
  // Bet365's bet IDs in API-Football, verified against real fixtures:
  //   1  Match Winner            13 First Half Winner (HT Result)
  //   5  Goals Over/Under        34 BTTS - First Half
  //   8  Both Teams Score        36 Win To Nil
  //   12 Double Chance           45 Corners Over/Under (9.5)
  //   7  HT/FT Double            24 Result + BTTS combo
  //   27 Clean Sheet Home        28 Clean Sheet Away
  //   9  Handicap Result (European Handicap, ±1/±2/±3)
  const mw = bets.find((b: any) => b.id === 1)
  const ou = bets.find((b: any) => b.id === 5)
  const btts = bets.find((b: any) => b.id === 8)
  const dc = bets.find((b: any) => b.id === 12)
  const htMw = bets.find((b: any) => b.id === 13)
  const htBtts = bets.find((b: any) => b.id === 34)
  const winNil = bets.find((b: any) => b.id === 36)
  const corners = bets.find((b: any) => b.id === 45)
  const htft = bets.find((b: any) => b.id === 7)        // HT/FT Double
  const resultBtts = bets.find((b: any) => b.id === 24) // Result + BTTS combo
  const cleanSheetH = bets.find((b: any) => b.id === 27)
  const cleanSheetA = bets.find((b: any) => b.id === 28)
  const handicap = bets.find((b: any) => b.id === 9)    // European Handicap

  const findOdd = (bet: any, valueName: string): number => {
    if (!bet) return 0
    return parseFloat(bet.values?.find((v: any) => v.value === valueName)?.odd || '0')
  }

  const home   = findOdd(mw, 'Home')
  const draw   = findOdd(mw, 'Draw')
  const away   = findOdd(mw, 'Away')

  // Goals totals — Bet365 exposes 1.5 / 2.5 / 3.5 lines on most fixtures
  const over15  = findOdd(ou, 'Over 1.5')
  const under15 = findOdd(ou, 'Under 1.5')
  const over25  = findOdd(ou, 'Over 2.5')
  const under25 = findOdd(ou, 'Under 2.5')
  const over35  = findOdd(ou, 'Over 3.5')
  const under35 = findOdd(ou, 'Under 3.5')

  const bttsYes = findOdd(btts, 'Yes')
  const bttsNo  = findOdd(btts, 'No')

  // Double Chance — API uses 'Home/Draw', 'Draw/Away', 'Home/Away'
  const dc1x = findOdd(dc, 'Home/Draw')
  const dcx2 = findOdd(dc, 'Draw/Away')
  const dc12 = findOdd(dc, 'Home/Away')

  // HT Result (First Half Winner)
  const htHome = findOdd(htMw, 'Home')
  const htDraw = findOdd(htMw, 'Draw')
  const htAway = findOdd(htMw, 'Away')

  // HT BTTS + Win-to-Nil + Corners 9.5 (single-line markets)
  const htBttsYes  = findOdd(htBtts, 'Yes')
  const winNilHome = findOdd(winNil, 'Home')
  const winNilAway = findOdd(winNil, 'Away')
  const corners95Over  = findOdd(corners, 'Over 9.5')
  const corners95Under = findOdd(corners, 'Under 9.5')

  // HT/FT Double — 6 most-common selections (Bet365 doesn't always offer
  // all 9 combinations). Each selection is "HT result / FT result".
  const htftHH = findOdd(htft, 'Home/Home')  // Home leads at HT, wins FT
  const htftHA = findOdd(htft, 'Home/Away')  // rare upset comeback
  const htftHD = findOdd(htft, 'Home/Draw')
  const htftDH = findOdd(htft, 'Draw/Home')  // Draw at HT → Home wins
  const htftDA = findOdd(htft, 'Draw/Away')
  const htftDD = findOdd(htft, 'Draw/Draw')

  // Result + BTTS combo (id=24) — e.g. "Home/Yes" = Home Win AND both score
  const rbttsHomeYes = findOdd(resultBtts, 'Home/Yes')
  const rbttsHomeNo  = findOdd(resultBtts, 'Home/No')
  const rbttsDrawYes = findOdd(resultBtts, 'Draw/Yes')
  const rbttsAwayYes = findOdd(resultBtts, 'Away/Yes')
  const rbttsAwayNo  = findOdd(resultBtts, 'Away/No')

  // Clean Sheet
  const csHomeYes = findOdd(cleanSheetH, 'Yes')
  const csAwayYes = findOdd(cleanSheetA, 'Yes')

  // European Handicap — typically the -1 / +1 lines are most common
  const ehHomeMinus1 = findOdd(handicap, 'Home -1')
  const ehAwayMinus1 = findOdd(handicap, 'Away -1')

  if (!home && !draw && !away) return null
  return {
    home, draw, away,
    over15, under15, over25, under25, over35, under35,
    btts: bttsYes, btts_no: bttsNo,
    dc_1x: dc1x, dc_x2: dcx2, dc_12: dc12,
    ht_home: htHome, ht_draw: htDraw, ht_away: htAway,
    ht_btts: htBttsYes,
    win_nil_home: winNilHome, win_nil_away: winNilAway,
    corners_over: corners95Over, corners_under: corners95Under,
    // Tier 1.5 additions: HT/FT + Result+BTTS combos + Clean Sheets + Handicap
    htft_hh: htftHH, htft_ha: htftHA, htft_hd: htftHD,
    htft_dh: htftDH, htft_da: htftDA, htft_dd: htftDD,
    rbtts_home_yes: rbttsHomeYes, rbtts_home_no: rbttsHomeNo,
    rbtts_draw_yes: rbttsDrawYes,
    rbtts_away_yes: rbttsAwayYes, rbtts_away_no: rbttsAwayNo,
    cs_home: csHomeYes, cs_away: csAwayYes,
    eh_home_m1: ehHomeMinus1, eh_away_m1: ehAwayMinus1,
  }
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

  // Concurrency tuning: each league fires 7 parallel API calls (fixtures,
  // injuries, standings, +4 odds). Concurrency 3 = 21 in-flight calls per
  // batch → silently hit API-Football's per-second rate ceiling, ~40% of
  // calls returned 429 (visible as api_failures count in cron response).
  // Dropped to 2 leagues/batch (14 in-flight) + 1500ms delay (was 800ms)
  // to halve the burst. Slower per cron run but no rate-limit drops.
  const leagueResults = await batchedAll(
    leagues,
    2,
    async (league) => {
      // Per-league season: European leagues = Aug-May start year, calendar
      // leagues (Friendlies, WC, MLS, Brasileirão, etc) = current year.
      // Before this, a single season=getCurrentSeason() was used for ALL
      // leagues, returning 0 fixtures for tournaments/calendar leagues in
      // every Jan-Jul window. Cause of the 20-day-stale cache before WC.
      const season = getSeasonForLeague(league)
      // Odds window = 6 days (today + 5 ahead). Covers a full Wed→Mon
      // weekend so Saturday + Sunday friendlies surface in the cache.
      // Safe to bump now that batch concurrency is down to 2 + 1500ms
      // delay — previous 8-day attempt broke at the old concurrency=3.
      const oddsDates = [
        today,
        getDatePlusDays(1),
        getDatePlusDays(2),
        getDatePlusDays(3),
        getDatePlusDays(4),
        getDatePlusDays(5),
      ]
      const [fixtures, injuries, standings, ...oddsByDay] = await Promise.all([
        apiFetch(`/fixtures?league=${league.id}&season=${season}&from=${today}&to=${in3days}&status=NS`, diag),
        apiFetch(`/injuries?league=${league.id}&season=${season}&date=${today}`, diag),
        apiFetch(`/standings?league=${league.id}&season=${season}`, diag),
        ...oddsDates.map((d) => apiFetch(`/odds?league=${league.id}&season=${season}&date=${d}`, diag)),
      ])

      const standingMap: Record<number, number> = {}
      const rawStandings = standings?.[0]?.league?.standings?.[0] ?? standings?.[0]?.league?.standings?.flat?.() ?? []
      for (const s of rawStandings) {
        if (s?.team?.id) standingMap[s.team.id] = s.rank
      }

      const oddsData: any[] = []
      for (const dayOdds of oddsByDay) {
        if (dayOdds) oddsData.push(...dayOdds)
      }
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
      // the matches with public interest and real edge potential. Within
      // each bucket, sort by date ASCENDING so today's matches always
      // outrank tomorrow's when slicing.
      //
      // Bug history: API-Football's fixtures endpoint doesn't guarantee
      // date ordering across calls. On 2026-06-03 the cron picked 8
      // Thursday friendlies, completely dropping today's Netherlands v
      // Algeria / Congo DR v Denmark / Poland v Nigeria. Explicit date
      // sort makes prioritisation deterministic — today's fixtures
      // ALWAYS get cache slots before tomorrow's.
      const byDateAsc = (a: any, b: any) =>
        new Date(a.fixture?.date ?? 0).getTime() - new Date(b.fixture?.date ?? 0).getTime()
      const allFixturesForLeague = (fixtures || []) as any[]
      const withOdds = allFixturesForLeague.filter((f: any) => oddsMap[f.fixture?.id]).sort(byDateAsc)
      const withoutOdds = allFixturesForLeague.filter((f: any) => !oddsMap[f.fixture?.id]).sort(byDateAsc)
      // Cap is per-league. For Friendlies (id=10) during pre-WC week
      // there are ~100 fixtures across 7 days. Earlier attempt at cap=40
      // saturated on Wed+Thu+Fri (9+11+20=40) and cut every Saturday
      // tune-up (USA v Germany, Belgium v Tunisia, Portugal v Chile,
      // Panama v Bosnia) plus all Sunday matches. Bumping to 70 leaves
      // room for the entire Wed→Mon window. Trade-off: more GPT calls
      // per cron run but acceptable during this 9-day pre-WC window.
      const perLeagueCap = league.id === 10 ? 70 : 4
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
    1500
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

  // Cap proportional to tier size, with a generous floor for pre-WC week
  // when one league (Friendlies) is doing most of the heavy lifting.
  // leagues.length * 5 for tier 3 (18 leagues) = 90 — high enough that
  // the friendlies per-league cap of 70 isn't trimmed by the round-robin.
  const cap = Math.max(8, leagues.length * 5)
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

Return JSON with this exact structure. CALIBRATE every probability against the implied market probability. Use lineup quality, recent form, ref tendencies for HT/corners markets:
{
  "predictions": [
    {
      "index": 1,
      "home_win_pct": 55,
      "draw_pct": 25,
      "away_win_pct": 20,
      "over_1_5_pct": 85,
      "over_2_5_pct": 65,
      "over_3_5_pct": 38,
      "btts_pct": 55,
      "ht_home_pct": 40,
      "ht_draw_pct": 38,
      "ht_away_pct": 22,
      "ht_btts_pct": 28,
      "corners_over_9_5_pct": 52,
      "win_to_nil_home_pct": 30,
      "win_to_nil_away_pct": 12,
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

    // GPT-returned probabilities WITH NULL FALLBACK. If GPT didn't return
    // a field (skipped it / hit token limit / wrong JSON), use null instead
    // of a hard-coded default. Markets with null prob get skipped in EV
    // calc below — better to surface fewer picks than fake-flag a +18%
    // EV on HT BTTS just because our default happened to beat the odds.
    const homeWinPct      = pred.home_win_pct      ?? null
    const drawPct         = pred.draw_pct          ?? null
    const awayWinPct      = pred.away_win_pct      ?? null
    const over15Pct       = pred.over_1_5_pct      ?? null
    const over25Pct       = pred.over_2_5_pct      ?? null
    const over35Pct       = pred.over_3_5_pct      ?? null
    const bttsPct         = pred.btts_pct          ?? null
    const htHomePct       = pred.ht_home_pct       ?? null
    const htDrawPct       = pred.ht_draw_pct       ?? null
    const htAwayPct       = pred.ht_away_pct       ?? null
    const htBttsPct       = pred.ht_btts_pct       ?? null
    const cornersOver95Pct = pred.corners_over_9_5_pct ?? null
    const winNilHomePct   = pred.win_to_nil_home_pct ?? null
    const winNilAwayPct   = pred.win_to_nil_away_pct ?? null

    // Derived probabilities — only computed if base probabilities exist
    const under15Pct        = over15Pct != null ? Math.max(0, 100 - over15Pct) : null
    const under25Pct        = over25Pct != null ? Math.max(0, 100 - over25Pct) : null
    const under35Pct        = over35Pct != null ? Math.max(0, 100 - over35Pct) : null
    const bttsNoPct         = bttsPct != null ? Math.max(0, 100 - bttsPct) : null
    const cornersUnder95Pct = cornersOver95Pct != null ? Math.max(0, 100 - cornersOver95Pct) : null
    const dc1xPct = (homeWinPct != null && drawPct != null) ? Math.min(100, homeWinPct + drawPct) : null
    const dcx2Pct = (drawPct != null && awayWinPct != null) ? Math.min(100, drawPct + awayWinPct) : null
    const dc12Pct = (homeWinPct != null && awayWinPct != null) ? Math.min(100, homeWinPct + awayWinPct) : null

    // EV is null when EITHER odds are missing OR GPT didn't predict the
    // probability. No fake values. No false-positive +EV picks from
    // defaults that happen to beat the implied odds.
    const evOr = (pct: number | null, odds: number | null | undefined) =>
      (pct != null && odds && odds > 1) ? calcEV(pct, odds) : null

    const homeEV         = evOr(homeWinPct, o?.home)
    const drawEV         = evOr(drawPct, o?.draw)
    const awayEV         = evOr(awayWinPct, o?.away)
    const over15EV       = evOr(over15Pct, o?.over15)
    const under15EV      = evOr(under15Pct, o?.under15)
    const over25EV       = evOr(over25Pct, o?.over25)
    const under25EV      = evOr(under25Pct, o?.under25)
    const over35EV       = evOr(over35Pct, o?.over35)
    const under35EV      = evOr(under35Pct, o?.under35)
    const bttsEV         = evOr(bttsPct, o?.btts)
    const bttsNoEV       = evOr(bttsNoPct, o?.btts_no)
    const dc1xEV         = evOr(dc1xPct, o?.dc_1x)
    const dcx2EV         = evOr(dcx2Pct, o?.dc_x2)
    const dc12EV         = evOr(dc12Pct, o?.dc_12)
    const htHomeEV       = evOr(htHomePct, o?.ht_home)
    const htDrawEV       = evOr(htDrawPct, o?.ht_draw)
    const htAwayEV       = evOr(htAwayPct, o?.ht_away)
    const htBttsEV       = evOr(htBttsPct, o?.ht_btts)
    const cornersOverEV  = evOr(cornersOver95Pct, o?.corners_over)
    const cornersUnderEV = evOr(cornersUnder95Pct, o?.corners_under)
    const winNilHomeEV   = evOr(winNilHomePct, o?.win_nil_home)
    const winNilAwayEV   = evOr(winNilAwayPct, o?.win_nil_away)

    // ── Tier 1.5: derived probabilities for 11 new markets ──────────────
    // Football outcomes are NOT independent — HT lead and FT win are tightly
    // correlated (~75-85% of teams leading at HT go on to win). Naive
    // multiplication with a 0.85 discount double-counts this correlation
    // and crushes probabilities below what the bookmaker is pricing, so
    // no picks ever surface.
    //
    // Use empirical conditional probabilities (P(FT | HT)) instead.
    // Source: long-run historical base rates across top European leagues.
    const cond = (a: number | null, factor: number) =>
      a != null ? Math.min(99, Math.round(a * factor)) : null

    // HT/FT — empirical conditional rates given HT state.
    //   P(Home win FT | Home leads HT)  ≈ 0.85
    //   P(Home win FT | HT draw)        ≈ 0.30
    //   P(FT draw     | HT draw)        ≈ 0.40
    //   P(Away win FT | HT draw)        ≈ 0.18
    const htftHHPct  = cond(htHomePct, 0.85)  // HT Home / FT Home
    const htftDHPct  = cond(htDrawPct, 0.30)  // HT Draw / FT Home
    const htftDDPct  = cond(htDrawPct, 0.40)  // HT Draw / FT Draw
    const htftDAPct  = cond(htDrawPct, 0.18)  // HT Draw / FT Away

    // Result + BTTS combos — less correlated than HT/FT but still not
    // independent (a 1-0 home win implies BTTS=No, a 3-2 implies BTTS=Yes).
    // Use multiplication with a 0.85 discount to keep combos conservative.
    const combo = (a: number | null, b: number | null) =>
      (a != null && b != null) ? Math.min(99, Math.round((a / 100) * (b / 100) * 0.85 * 100)) : null
    const rbttsHomeYesPct = combo(homeWinPct, bttsPct)
    const rbttsHomeNoPct  = combo(homeWinPct, bttsNoPct)
    const rbttsDrawYesPct = combo(drawPct, bttsPct)
    const rbttsAwayYesPct = combo(awayWinPct, bttsPct)
    const rbttsAwayNoPct  = combo(awayWinPct, bttsNoPct)

    // Clean Sheet ≈ Win-to-Nil (same outcome from defending team's view).
    // Bet365 rarely supplies bet ID 27/28, so most fixtures fall back to
    // null odds and these candidates are silently skipped — that's fine,
    // we leave the code in so other bookmakers (Pinnacle etc.) can fill it.
    const csHomePct = winNilHomePct
    const csAwayPct = winNilAwayPct

    // European Handicap -1: home wins by 2+ goals. Roughly homeWin × 0.55
    // (most home wins are 1-goal margins, so ~45% of home wins are by 2+).
    const ehHomePct = homeWinPct != null ? Math.round(homeWinPct * 0.55) : null
    const ehAwayPct = awayWinPct != null ? Math.round(awayWinPct * 0.55) : null

    const htftHHEV  = evOr(htftHHPct, o?.htft_hh)
    const htftDHEV  = evOr(htftDHPct, o?.htft_dh)
    const htftDDEV  = evOr(htftDDPct, o?.htft_dd)
    const htftDAEV  = evOr(htftDAPct, o?.htft_da)
    const rbttsHYEV = evOr(rbttsHomeYesPct, o?.rbtts_home_yes)
    const rbttsHNEV = evOr(rbttsHomeNoPct, o?.rbtts_home_no)
    const rbttsDYEV = evOr(rbttsDrawYesPct, o?.rbtts_draw_yes)
    const rbttsAYEV = evOr(rbttsAwayYesPct, o?.rbtts_away_yes)
    const rbttsANEV = evOr(rbttsAwayNoPct, o?.rbtts_away_no)
    const csHomeEV  = evOr(csHomePct, o?.cs_home)
    const csAwayEV  = evOr(csAwayPct, o?.cs_away)
    const ehHomeEV  = evOr(ehHomePct, o?.eh_home_m1)
    const ehAwayEV  = evOr(ehAwayPct, o?.eh_away_m1)

    // Tightened EV ceiling: real value-bet edges sit in 1-5%. Picks
    // claiming +15-25% EV are almost always calibration errors (GPT
    // overestimating probability OR our prob using a default value
    // that accidentally beats the implied odds). Cap at 10 so flagged
    // picks pass a basic statistical reasonableness check.
    const MAX_REAL_EV = 10
    const MAX_REAL_ODDS = 6.0
    // 22 markets evaluated (was 10). Diversity rule below keeps the picks
    // page varied — when top-EV is Totals AND a non-totals is within 3%,
    // the non-totals wins.
    const allCandidates = [
      // Match Result
      { label: 'Home Win',         category: '1x2',     ev: homeEV,         odds: o?.home,         aiPct: homeWinPct },
      { label: 'Draw',             category: '1x2',     ev: drawEV,         odds: o?.draw,         aiPct: drawPct },
      { label: 'Away Win',         category: '1x2',     ev: awayEV,         odds: o?.away,         aiPct: awayWinPct },
      // Double Chance
      { label: '1X',               category: 'dc',      ev: dc1xEV,         odds: o?.dc_1x,        aiPct: dc1xPct },
      { label: 'X2',               category: 'dc',      ev: dcx2EV,         odds: o?.dc_x2,        aiPct: dcx2Pct },
      { label: '12',               category: 'dc',      ev: dc12EV,         odds: o?.dc_12,        aiPct: dc12Pct },
      // Totals (3 lines)
      { label: 'Over 1.5',         category: 'totals',  ev: over15EV,       odds: o?.over15,       aiPct: over15Pct },
      { label: 'Under 1.5',        category: 'totals',  ev: under15EV,      odds: o?.under15,      aiPct: under15Pct },
      { label: 'Over 2.5',         category: 'totals',  ev: over25EV,       odds: o?.over25,       aiPct: over25Pct },
      { label: 'Under 2.5',        category: 'totals',  ev: under25EV,      odds: o?.under25,      aiPct: under25Pct },
      { label: 'Over 3.5',         category: 'totals',  ev: over35EV,       odds: o?.over35,       aiPct: over35Pct },
      { label: 'Under 3.5',        category: 'totals',  ev: under35EV,      odds: o?.under35,      aiPct: under35Pct },
      // BTTS
      { label: 'BTTS',             category: 'btts',    ev: bttsEV,         odds: o?.btts,         aiPct: bttsPct },
      { label: 'BTTS No',          category: 'btts',    ev: bttsNoEV,       odds: o?.btts_no,      aiPct: bttsNoPct },
      // Half-time
      { label: 'HT Home',          category: 'ht',      ev: htHomeEV,       odds: o?.ht_home,      aiPct: htHomePct },
      { label: 'HT Draw',          category: 'ht',      ev: htDrawEV,       odds: o?.ht_draw,      aiPct: htDrawPct },
      { label: 'HT Away',          category: 'ht',      ev: htAwayEV,       odds: o?.ht_away,      aiPct: htAwayPct },
      { label: 'HT BTTS',          category: 'ht',      ev: htBttsEV,       odds: o?.ht_btts,      aiPct: htBttsPct },
      // Corners
      { label: 'Corners Over 9.5', category: 'corners', ev: cornersOverEV,  odds: o?.corners_over, aiPct: cornersOver95Pct },
      { label: 'Corners Under 9.5',category: 'corners', ev: cornersUnderEV, odds: o?.corners_under,aiPct: cornersUnder95Pct },
      // Win to Nil
      { label: 'Home Win to Nil',  category: 'winnil',  ev: winNilHomeEV,   odds: o?.win_nil_home, aiPct: winNilHomePct },
      { label: 'Away Win to Nil',  category: 'winnil',  ev: winNilAwayEV,   odds: o?.win_nil_away, aiPct: winNilAwayPct },
      // HT/FT — high-payout markets ideal for big mismatches
      { label: 'HT Home / FT Home', category: 'htft',   ev: htftHHEV,       odds: o?.htft_hh,      aiPct: htftHHPct },
      { label: 'HT Draw / FT Home', category: 'htft',   ev: htftDHEV,       odds: o?.htft_dh,      aiPct: htftDHPct },
      { label: 'HT Draw / FT Draw', category: 'htft',   ev: htftDDEV,       odds: o?.htft_dd,      aiPct: htftDDPct },
      { label: 'HT Draw / FT Away', category: 'htft',   ev: htftDAEV,       odds: o?.htft_da,      aiPct: htftDAPct },
      // Result + BTTS combos
      { label: 'Home & BTTS Yes',   category: 'rbtts',  ev: rbttsHYEV,      odds: o?.rbtts_home_yes, aiPct: rbttsHomeYesPct },
      { label: 'Home & BTTS No',    category: 'rbtts',  ev: rbttsHNEV,      odds: o?.rbtts_home_no,  aiPct: rbttsHomeNoPct },
      { label: 'Draw & BTTS Yes',   category: 'rbtts',  ev: rbttsDYEV,      odds: o?.rbtts_draw_yes, aiPct: rbttsDrawYesPct },
      { label: 'Away & BTTS Yes',   category: 'rbtts',  ev: rbttsAYEV,      odds: o?.rbtts_away_yes, aiPct: rbttsAwayYesPct },
      { label: 'Away & BTTS No',    category: 'rbtts',  ev: rbttsANEV,      odds: o?.rbtts_away_no,  aiPct: rbttsAwayNoPct },
      // Clean Sheet
      { label: 'Home Clean Sheet',  category: 'cs',     ev: csHomeEV,       odds: o?.cs_home,      aiPct: csHomePct },
      { label: 'Away Clean Sheet',  category: 'cs',     ev: csAwayEV,       odds: o?.cs_away,      aiPct: csAwayPct },
      // European Handicap -1 (team wins by 2+ goals)
      { label: 'Home -1 Handicap',  category: 'eh',     ev: ehHomeEV,       odds: o?.eh_home_m1,   aiPct: ehHomePct },
      { label: 'Away -1 Handicap',  category: 'eh',     ev: ehAwayEV,       odds: o?.eh_away_m1,   aiPct: ehAwayPct },
    ]
    const valueBets = allCandidates
      .filter(x => x.ev !== null && x.ev > 0 && x.ev <= MAX_REAL_EV)
      .filter(x => !x.odds || x.odds <= MAX_REAL_ODDS)
      .sort((a, b) => (b.ev ?? 0) - (a.ev ?? 0))

    // Diversity rule: if the top EV is a Totals pick (Over/Under 2.5) AND
    // another category is within 3% EV of it, prefer the non-totals pick.
    // Fixes the "every site recommendation is Over 2.5" monoculture
    // visible during friendly-heavy weeks.
    let bestValue = valueBets[0] ?? null
    if (bestValue?.category === 'totals' && valueBets.length > 1) {
      const nonTotalsAlt = valueBets.find(
        v => v.category !== 'totals' && (bestValue!.ev! - (v.ev ?? 0)) <= 3,
      )
      if (nonTotalsAlt) bestValue = nonTotalsAlt
    }
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
      // Match-result probabilities
      home_win_pct: homeWinPct,
      draw_pct: drawPct,
      away_win_pct: awayWinPct,
      // Totals (3 lines, was just 2.5)
      over_1_5_pct: over15Pct,
      over_2_5_pct: over25Pct,
      over_3_5_pct: over35Pct,
      // BTTS + HT + corners + win-to-nil (Tier 1 expansion)
      btts_pct: bttsPct,
      ht_home_pct: htHomePct,
      ht_draw_pct: htDrawPct,
      ht_away_pct: htAwayPct,
      ht_btts_pct: htBttsPct,
      corners_over_9_5_pct: cornersOver95Pct,
      win_to_nil_home_pct: winNilHomePct,
      win_to_nil_away_pct: winNilAwayPct,
      confidence: pred.confidence ?? 6,
      recommended_bet: pred.recommended_bet ?? 'No clear value',
      recommended_odds_range: pred.recommended_odds_range ?? '—',
      key_factors: pred.key_factors ?? [],
      risk_level: pred.risk_level ?? 'Medium',
      // Pick-specific explanation. GPT generates a generic match-level
      // edge_explanation that often talks about a Home Win even when the
      // EV math picked HT BTTS — confusing to users. Override with a
      // market-aware template when the GPT text doesn't mention the
      // picked market's keywords.
      edge_explanation: (() => {
        const gpt = (pred.edge_explanation || '').trim()
        if (!bestValue) return gpt || null
        const label = bestValue.label.toLowerCase()
        const t = gpt.toLowerCase()
        const matchesPick =
          (label.includes('over') || label.includes('under')) ? (t.includes('goal') || t.includes('over') || t.includes('under') || t.includes('high-scoring') || t.includes('low-scoring')) :
          label.includes('btts')      ? (t.includes('both') || t.includes('btts') || t.includes('attack')) :
          label.startsWith('ht ')     ? (t.includes('half') || t.includes('first 45') || t.includes('early')) :
          label.includes('corner')    ? t.includes('corner') :
          label.includes('win to nil')? (t.includes('clean sheet') || t.includes('nil')) :
          true // 1X2 / DC — GPT match-level explanation usually fits
        if (matchesPick && gpt) return gpt
        // Template fallback so the UI never shows a contradictory explanation.
        const aiPct = Math.round(bestValue.aiPct)
        const implied = bestValue.odds ? Math.round(100 / bestValue.odds) : null
        const edge = implied != null ? aiPct - implied : null
        return implied != null
          ? `Model estimates ${aiPct}% probability for ${bestValue.label} vs market's implied ${implied}%. +${edge}% edge.`
          : `Model rates ${bestValue.label} at ${aiPct}% probability — flagged as +EV against current market price.`
      })(),
      // Bookmaker odds + every EV value (22 markets) so the UI can
      // surface alternate picks beyond just best_value if it wants to.
      bookmaker: o ? {
        home: o.home || null,
        draw: o.draw || null,
        away: o.away || null,
        over15: o.over15 || null,
        over25: o.over25 || null,
        over35: o.over35 || null,
        btts: o.btts || null,
        ht_home: o.ht_home || null,
        ht_draw: o.ht_draw || null,
        ht_away: o.ht_away || null,
        ht_btts: o.ht_btts || null,
        corners_over: o.corners_over || null,
        win_nil_home: o.win_nil_home || null,
        win_nil_away: o.win_nil_away || null,
      } : null,
      bookmaker_name: f._oddsBookmaker ?? null,
      ev: {
        home: homeEV, draw: drawEV, away: awayEV,
        over15: over15EV, over25: over25EV, over35: over35EV,
        btts: bttsEV, btts_no: bttsNoEV,
        dc_1x: dc1xEV, dc_x2: dcx2EV, dc_12: dc12EV,
        ht_home: htHomeEV, ht_draw: htDrawEV, ht_away: htAwayEV, ht_btts: htBttsEV,
        corners_over: cornersOverEV, corners_under: cornersUnderEV,
        win_nil_home: winNilHomeEV, win_nil_away: winNilAwayEV,
      },
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
      // OVERWRITE existing rows so a re-evaluation with a tighter EV ceiling
      // (or a different best-value market) replaces the stale row instead
      // of silently shadowing it. Was `ignoreDuplicates: true` — that bug
      // let pre-MAX_REAL_EV=10 rows with +20% EV survive forever and
      // surface in /api/cron/daily-digest etc.
      await supabaseAdmin
        .from('prediction_records')
        .upsert(records, { onConflict: 'fixture_id,prediction' })
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
