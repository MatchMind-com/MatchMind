import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { rateLimit, getClientKey, rateLimitResponse } from '@/lib/rate-limit'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 30-minute cache now that we have 7,500 req/day
// Picks should stay stable for the betting day, not shuffle every 30 min.
// 4-hour cache means the morning prediction batch holds until after lunch,
// then again until end of day. Reduces OpenAI cost ~8x as a side effect.
export const revalidate = 14400

// Vercel function timeout — needs to be high because we make ~325 API-Football calls
// (25 leagues × 5 fixture/odds/injuries/standings calls + 40 fixtures × 5 form/H2H/stats calls)
// plus a GPT-4o completion. Pro plan allows up to 60s.
export const maxDuration = 60

// Track silent API-Football failures so we can surface them in the response
type FetchDiag = { path: string; reason: string; status?: number }
const fetchDiagnostics: FetchDiag[] = []

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

async function apiFetch(path: string, diag?: FetchDiag[]) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 1800 },
    })
    if (!res.ok) {
      const reason = res.status === 429 ? 'rate_limited' : `http_${res.status}`
      ;(diag || fetchDiagnostics).push({ path, reason, status: res.status })
      console.warn(`[apiFetch] ${reason} ${res.status} ${path}`)
      return null
    }
    const json = await res.json()
    // API-Football returns errors[] inside a 200 response when something is wrong
    if (json?.errors && (Array.isArray(json.errors) ? json.errors.length : Object.keys(json.errors).length)) {
      ;(diag || fetchDiagnostics).push({ path, reason: `api_error:${JSON.stringify(json.errors)}` })
      console.warn(`[apiFetch] api_error ${path}`, json.errors)
    }
    return json.response || null
  } catch (e: any) {
    ;(diag || fetchDiagnostics).push({ path, reason: `exception:${e.message}` })
    console.warn(`[apiFetch] exception ${path}`, e.message)
    return null
  }
}

// Run a list of async tasks in parallel, but in chunks of `concurrency`.
// Avoids the burst that trips API-Football's per-second rate-limit smoothing.
// Optional `interBatchDelayMs` adds a fixed pause between batches.
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

// Pinnacle (sharp market) vs Bet365 edge detection
// Pinnacle's implied probability = closest to true odds → when Bet365 is longer, that's value
type OddsShape = { home: number; draw: number; away: number; over25: number; btts: number } | null
function calcPinnacleEdge(
  pinnacle: OddsShape,
  bet365: OddsShape
): { market: string; edge_pct: number; pinnacle_odds: number; bet365_odds: number } | null {
  if (!pinnacle || !bet365) return null
  const markets = [
    { key: 'home'   as const, label: 'Home Win' },
    { key: 'draw'   as const, label: 'Draw'     },
    { key: 'away'   as const, label: 'Away Win' },
    { key: 'over25' as const, label: 'Over 2.5' },
    { key: 'btts'   as const, label: 'BTTS'     },
  ]
  let best: { market: string; edge_pct: number; pinnacle_odds: number; bet365_odds: number } | null = null
  for (const { key, label } of markets) {
    const pOdds = pinnacle[key]
    const bOdds = bet365[key]
    if (!pOdds || !bOdds || pOdds <= 1 || bOdds <= 1) continue
    // Edge = how much more Pinnacle implies vs what Bet365 implies (in % points)
    const edge = (1 / pOdds - 1 / bOdds) * 100
    const edgeRounded = Math.round(edge * 10) / 10
    if (edgeRounded >= 2 && (!best || edgeRounded > best.edge_pct)) {
      best = { market: label, edge_pct: edgeRounded, pinnacle_odds: pOdds, bet365_odds: bOdds }
    }
  }
  return best
}

// Format last-5 form for a team: "W 2-1 vs Arsenal (H) | D 1-1 vs Chelsea (A) | ..."
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

// Extract clean team stats from /teams/statistics response
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

// Format H2H fixtures: "Man Utd 2-1 Liverpool | Arsenal 0-0 Man Utd | ..."
function formatH2H(fixtures: any[]): string {
  if (!fixtures?.length) return 'No H2H data'
  return fixtures.slice(0, 5).map((f: any) => {
    const homeGoals = f.goals?.home ?? '?'
    const awayGoals = f.goals?.away ?? '?'
    const home = f.teams?.home?.name
    const away = f.teams?.away?.name
    return `${home} ${homeGoals}-${awayGoals} ${away}`
  }).join(' | ')
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
  { id: 203, name: 'Süper Lig',         flag: '🇹🇷' },
  { id: 40,  name: 'Championship',      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 144, name: 'Pro League',        flag: '🇧🇪' },
  { id: 113, name: 'Allsvenskan',       flag: '🇸🇪' },
  { id: 262, name: 'Liga MX',           flag: '🇲🇽' },
  { id: 253, name: 'MLS',               flag: '🇺🇸' },
  { id: 71,  name: 'Brasileirão',       flag: '🇧🇷' },
  { id: 128, name: 'Argentine Primera', flag: '🇦🇷' },
  { id: 13,  name: 'Copa Libertadores', flag: '🏆' },
  { id: 11,  name: 'Copa Sudamericana', flag: '🥈' },
  { id: 307, name: 'Saudi Pro League',  flag: '🇸🇦' },
  { id: 98,  name: 'J1 League',         flag: '🇯🇵' },
  { id: 179, name: 'Scottish Premiership', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { id: 106, name: 'Ekstraklasa',       flag: '🇵🇱' },
  { id: 1,   name: 'World Cup',         flag: '🌍' },
]

export async function GET(request: Request) {
  // Rate limit: 20 calls per minute per IP — this endpoint burns OpenAI credits
  const rl = rateLimit(`predictions:${getClientKey(request)}`, 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl.resetMs)

  try {
    const season = getCurrentSeason()
    const today = new Date().toISOString().split('T')[0]
    const in3days = getDatePlusDays(4)

    const tomorrow = getDatePlusDays(1)

    // Reset diagnostics for this request
    fetchDiagnostics.length = 0
    const requestDiag: FetchDiag[] = []

    // Fetch fixtures + Bet365 odds per league.
    // Batched: 2 leagues at a time × 5 calls each = 10 in-flight max,
    // with a 1000ms breather between batches.
    // 25 leagues / 2 = 13 batches × ~1.5s = ~20s for league setup.
    // ~6.7 calls/sec sustained — well under API-Football Pro's 7.5/sec average.
    // Earlier attempts at concurrency=3+400ms still tripped per-minute smoothing.
    const leagueResults = await batchedAll(TOP_LEAGUES, 2, async (league) => {
        const [fixtures, oddsToday, oddsTomorrow, injuries, standings] = await Promise.all([
          apiFetch(`/fixtures?league=${league.id}&season=${season}&from=${today}&to=${in3days}&status=NS`, requestDiag),
          apiFetch(`/odds?league=${league.id}&season=${season}&date=${today}`, requestDiag),     // all bookmakers today
          apiFetch(`/odds?league=${league.id}&season=${season}&date=${tomorrow}`, requestDiag),  // all bookmakers tomorrow
          apiFetch(`/injuries?league=${league.id}&season=${season}&date=${today}`, requestDiag),
          apiFetch(`/standings?league=${league.id}&season=${season}`, requestDiag),
        ])

        // Build teamId → league position map
        const standingMap: Record<number, number> = {}
        const rawStandings = standings?.[0]?.league?.standings?.[0] ?? standings?.[0]?.league?.standings?.flat?.() ?? []
        for (const s of rawStandings) {
          if (s?.team?.id) standingMap[s.team.id] = s.rank
        }

        // Merge today + tomorrow odds into a single map
        const oddsData = [...(oddsToday || []), ...(oddsTomorrow || [])]

        // Build fixture_id → Bet365 odds map (prefer Bet365 id=1, fallback to Pinnacle id=29, then any bookmaker)
        const oddsMap: Record<number, ReturnType<typeof extractOdds>> = {}
        const pinnacleMap: Record<number, ReturnType<typeof extractOdds>> = {}
        const oddsBookmakerName: Record<number, string> = {}

        for (const entry of oddsData) {
          const fid = entry.fixture?.id
          if (!fid) continue
          const bookmakers: any[] = entry.bookmakers || []

          // Extract Pinnacle separately for edge detection
          const pinnacleRaw = bookmakers.find((b: any) => b.id === 29)
          if (pinnacleRaw) pinnacleMap[fid] = extractOdds(pinnacleRaw)

          // Prefer Bet365 → then Pinnacle → then first available
          const bet365Raw = bookmakers.find((b: any) => b.id === 1)
          const anyRaw = bookmakers[0]
          const chosen = bet365Raw || pinnacleRaw || anyRaw
          if (chosen) {
            oddsMap[fid] = extractOdds(chosen)
            oddsBookmakerName[fid] = chosen.name || 'Live'
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

        return (fixtures || []).slice(0, 4).map((f: any) => ({
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
      }, 1000) // 1s breather between batches

    // Round-robin across leagues so every league with fixtures gets at least one slot
    // before any league gets a second. Naive .flat().slice(0, N) takes everything
    // from the first few leagues in TOP_LEAGUES order — Premier/LaLiga/SerieA/Bundesliga
    // alone fill 16 slots and silently shut out UCL, Championship, Saudi, etc.
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
        if (added === 0) break // every league exhausted
        round++
      }
      return picked
    }
    // Cap at 18 fixtures: 18 × 5 per-fixture calls = 90 calls in the form-fetch phase.
    // With league-phase ~125 calls, total ≈ 215 calls in ≈30s — fits 450/min limit.
    const allFixtures = roundRobinPick(leagueResults, 18)

    // Inter-phase breather: lets the per-minute window slide before we burst again.
    // Without this, league + form phases combine into one ~30s burst that crests 450/min.
    if (allFixtures.length > 0) await new Promise(r => setTimeout(r, 2000))

    if (allFixtures.length === 0) {
      return NextResponse.json(
        { success: true, predictions: [], message: 'No upcoming fixtures found' },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }

    // ── Fetch form, H2H + team stats per fixture (chunked) ────────────────────
    // 2 fixtures at a time × 5 calls each = 10 in-flight, with 1000ms breathers.
    // 16 fixtures / 2 = 8 batches × ~1.5s = ~12s for the form phase.
    // Matches the league phase pacing to keep us under the 450/min ceiling.
    const formData = await batchedAll(allFixtures, 2, async (f: any) => {
      const homeId = f.teams?.home?.id
      const awayId = f.teams?.away?.id
      const leagueId = f._leagueId
      if (!homeId || !awayId) return { homeId: null, awayId: null, homeForm: null, awayForm: null, h2h: null, homeStats: null, awayStats: null }
      const [homeForm, awayForm, h2h, homeStatsRaw, awayStatsRaw] = await Promise.all([
        apiFetch(`/fixtures?team=${homeId}&last=5`, requestDiag),
        apiFetch(`/fixtures?team=${awayId}&last=5`, requestDiag),
        apiFetch(`/fixtures/headtohead?h2h=${homeId}-${awayId}&last=5`, requestDiag),
        apiFetch(`/teams/statistics?league=${leagueId}&season=${season}&team=${homeId}`, requestDiag),
        apiFetch(`/teams/statistics?league=${leagueId}&season=${season}&team=${awayId}`, requestDiag),
      ])
      const homeStats = extractTeamStats(homeStatsRaw, f._homePosition)
      const awayStats = extractTeamStats(awayStatsRaw, f._awayPosition)
      return { homeId, awayId, homeForm, awayForm, h2h, homeStats, awayStats }
    }, 1000)

    // Build prompt with real odds, injuries, form, and H2H
    // Include implied market probabilities so the AI anchors to them instead of hallucinating
    const impliedProb = (odds: number | null | undefined) => odds && odds > 1 ? Math.round(100 / odds) : null
    const fixtureList = allFixtures.map((f: any, i: number) => {
      const home = f.teams?.home?.name
      const away = f.teams?.away?.name
      const date = new Date(f.fixture?.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      const o = f._odds
      const hImp = impliedProb(o?.home)
      const dImp = impliedProb(o?.draw)
      const aImp = impliedProb(o?.away)
      const oddsStr = o?.home
        ? ` | Bet365 odds: H ${o.home} (${hImp}% implied) / D ${o.draw} (${dImp}% implied) / A ${o.away} (${aImp}% implied)`
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
      // temperature 0 + seed makes GPT deterministic for the same input,
      // so picks don't shuffle on every page refresh.
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
5. A real value bet edge is typically 2-8%. EV above +20% is almost always a calibration error, not a real opportunity. Be suspicious of your own big edges.

Return valid JSON only.`
      }, {
        role: 'user',
        content: `Generate CALIBRATED predictions for these ${season}/${String(season + 1).slice(2)} season matches. Real form data, H2H, injuries, and Bet365 odds (with implied probabilities) are provided. Your probabilities must be anchored to the market odds unless you cite a concrete reason to deviate.

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
      "risk_level": "Low",
      "edge_explanation": "2-sentence plain-English explanation of WHY this bet has mathematical edge — reference the actual form data and odds. E.g. 'Liverpool have won their last 4 home games and conceded just twice, while Bet365's 2.20 odds imply only a 45% chance — our model gives them 58% based on current form and H2H dominance.'"
    }
  ]
}`
      }],
      max_tokens: 8000,
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

      // Rank value bets by EV.
      // SANITY CAP: reject anything above +25% — that's almost always a model
      // calibration error, not a real edge. Real sharp bettors find +2-8% edges.
      // Also reject picks on odds > 4.0 (underdog longshots where AI tends to
      // be poorly calibrated).
      const MAX_REAL_EV = 25
      const MAX_REAL_ODDS = 4.0
      // Draws are excluded from value-bet ranking. Draw markets have high
      // variance vs. edge — a small probability advantage gets eaten by noise.
      // Sharp bettors avoid them unless they have a calibrated model with
      // deep draw-specific signal, which we don't have yet.
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

      // Pinnacle edge: compare sharp market (Pinnacle) vs soft market (Bet365)
      const pinnacleEdge = calcPinnacleEdge(f._pinnacleOdds ?? null, o ?? null)
      const isPinnacleValueBet = pinnacleEdge !== null

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
        edge_explanation: pred.edge_explanation ?? null,
        // Real bookmaker odds (Bet365 preferred, fallback to best available)
        bookmaker: o ? {
          home: o.home || null,
          draw: o.draw || null,
          away: o.away || null,
          over25: o.over25 || null,
          btts: o.btts || null,
        } : null,
        bookmaker_name: f._oddsBookmaker ?? null,
        // Expected value per market
        ev: { home: homeEV, draw: drawEV, away: awayEV, over25: over25EV, btts: bttsEV },
        best_value: bestValue,
        // Pinnacle sharp-money edge (the core differentiator)
        pinnacle_edge: pinnacleEdge,
        is_value_bet: (bestValue !== null && (bestValue.ev ?? 0) >= 5) || isPinnacleValueBet,
        value_score: pinnacleEdge?.edge_pct ?? bestValue?.ev ?? null,
        // Injuries
        home_injuries: f._homeInjuries ?? [],
        away_injuries: f._awayInjuries ?? [],
        // Lineups (if available)
        lineups: lineupMap[f.fixture?.id] ?? null,
        // Team season statistics
        home_stats: formData[i]?.homeStats ?? null,
        away_stats: formData[i]?.awayStats ?? null,
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
          // Store the probability for the ACTUAL pick, not always home_win_pct.
          // Keys into the valueBets entries built upstream.
          ai_probability: (p.best_value as any).aiPct ?? null,
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

    // Surface league coverage + silent API-Football failures for visibility
    const leaguesWithFixtures = Array.from(new Set(allFixtures.map((f: any) => f._leagueName)))
    const meta = {
      leagues_attempted: TOP_LEAGUES.length,
      leagues_with_fixtures: leaguesWithFixtures.length,
      fixture_count: allFixtures.length,
      league_names: leaguesWithFixtures,
      api_failures: requestDiag.length,
      api_failure_sample: requestDiag.slice(0, 10),
    }
    return NextResponse.json({ success: true, predictions, meta })
  } catch (err) {
    console.error('Predictions error:', err)
    return NextResponse.json({ success: false, error: 'Failed to generate predictions' }, { status: 500 })
  }
}
