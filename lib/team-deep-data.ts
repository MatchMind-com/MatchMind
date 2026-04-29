/**
 * lib/team-deep-data — fetch comprehensive per-team data on demand.
 *
 * Once the team-resolver has identified a team mentioned in the user's
 * message, this module pulls the four key data slices (injuries, last 5
 * results, next 5 fixtures, season stats) IN PARALLEL from API-Football
 * with per-call 5s timeouts.
 *
 * Output is then injected into the AI Coach system prompt as a
 * "🔬 DEEP DATA — Team Name (League)" block so the model can reference
 * specific players, scores, dates, and league position.
 *
 * Caching: 5-minute LRU keyed by `${teamId}:${leagueId}` — form/injuries
 * change on a daily cadence, not minute-by-minute.
 */
import type { TeamMatch } from '@/lib/team-resolver'
import { findLeague } from '@/lib/leagues'

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'
const TIMEOUT_MS = 5000

export type TeamDeepData = {
  team: TeamMatch
  injuries: Array<{ player: string; reason: string }>
  last5: Array<{ home: string; away: string; score: string; date: string; result: 'W' | 'D' | 'L' }>
  next5: Array<{ home: string; away: string; date: string; venue: string }>
  seasonStats: {
    played: number
    wins: number
    draws: number
    losses: number
    goalsFor: number
    goalsAgainst: number
    goalsPerGame: number
    cleanSheets: number
    leaguePosition: number | null
  } | null
  topScorer: string | null
}

// ── Tiny LRU cache (5-minute TTL) ──────────────────────────────────────────
type CacheEntry = { data: TeamDeepData; ts: number }
const TTL_MS = 5 * 60 * 1000
const CACHE_MAX = 100
const cache = new Map<string, CacheEntry>()

function cacheGet(key: string): TeamDeepData | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > TTL_MS) {
    cache.delete(key)
    return null
  }
  // Refresh recency: re-insert so it's at the tail of insertion order.
  cache.delete(key)
  cache.set(key, entry)
  return entry.data
}

function cacheSet(key: string, data: TeamDeepData): void {
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }
  cache.set(key, { data, ts: Date.now() })
}

function getCurrentSeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 8 ? year : year - 1
}

/** Best-effort fetch with per-call timeout. Never throws. */
async function safeFetch(path: string): Promise<any | null> {
  if (!API_KEY) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      signal: controller.signal,
      next: { revalidate: 300 }, // 5 min — matches our LRU TTL
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.response ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return 'TBC'
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return 'TBC'
  }
}

/**
 * Pull comprehensive data for one team. Returns partial data on any failure
 * — never throws. Callers can render whatever fields are populated.
 */
export async function getTeamDeepData(
  teamId: number,
  leagueId: number,
): Promise<TeamDeepData> {
  const season = getCurrentSeason()
  const cacheKey = `${teamId}:${leagueId}:${season}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  // Build the team match scaffold so we always return something coherent.
  const lge = findLeague(leagueId)
  const baseTeam: TeamMatch = {
    id: teamId,
    name: '',
    leagueId,
    leagueName: lge?.name ?? null,
    country: lge?.country ?? null,
    logo: `https://media.api-sports.io/football/teams/${teamId}.png`,
  }

  // 4 calls in parallel — each guarded.
  const [injuriesResRaw, last5Raw, next5Raw, statsRaw] = await Promise.all([
    safeFetch(`/injuries?team=${teamId}&season=${season}`).catch(() => null),
    safeFetch(`/fixtures?team=${teamId}&last=5`).catch(() => null),
    safeFetch(`/fixtures?team=${teamId}&next=5`).catch(() => null),
    safeFetch(`/teams/statistics?season=${season}&team=${teamId}&league=${leagueId}`).catch(() => null),
  ])

  // ── Injuries ──────────────────────────────────────────────────────────
  const injuries: TeamDeepData['injuries'] = []
  if (Array.isArray(injuriesResRaw)) {
    for (const inj of injuriesResRaw.slice(0, 10)) {
      const player = inj?.player?.name
      const reason = inj?.player?.reason ?? 'unspecified'
      if (typeof player === 'string') injuries.push({ player, reason })
    }
  }

  // ── Last 5 results ────────────────────────────────────────────────────
  const last5: TeamDeepData['last5'] = []
  if (Array.isArray(last5Raw)) {
    for (const f of last5Raw.slice(0, 5)) {
      const home = f?.teams?.home?.name ?? '?'
      const away = f?.teams?.away?.name ?? '?'
      const homeGoals = f?.goals?.home ?? 0
      const awayGoals = f?.goals?.away ?? 0
      const isHome = f?.teams?.home?.id === teamId
      let result: 'W' | 'D' | 'L' = 'D'
      if (homeGoals === awayGoals) result = 'D'
      else if (isHome) result = homeGoals > awayGoals ? 'W' : 'L'
      else result = awayGoals > homeGoals ? 'W' : 'L'
      last5.push({
        home,
        away,
        score: `${homeGoals}-${awayGoals}`,
        date: fmtDate(f?.fixture?.date),
        result,
      })
      // Capture the team name from the first fixture we see so the prompt
      // header has the real label even when /teams/statistics fails.
      if (!baseTeam.name && (isHome || f?.teams?.away?.id === teamId)) {
        baseTeam.name = isHome ? home : away
      }
    }
  }

  // ── Next 5 fixtures ───────────────────────────────────────────────────
  const next5: TeamDeepData['next5'] = []
  if (Array.isArray(next5Raw)) {
    for (const f of next5Raw.slice(0, 5)) {
      const home = f?.teams?.home?.name ?? '?'
      const away = f?.teams?.away?.name ?? '?'
      const venue = f?.fixture?.venue?.name ?? ''
      next5.push({
        home,
        away,
        date: fmtDate(f?.fixture?.date),
        venue,
      })
      if (!baseTeam.name) {
        if (f?.teams?.home?.id === teamId) baseTeam.name = home
        else if (f?.teams?.away?.id === teamId) baseTeam.name = away
      }
    }
  }

  // ── Season stats + league position + top scorer ───────────────────────
  let seasonStats: TeamDeepData['seasonStats'] = null
  let topScorer: string | null = null
  if (statsRaw && typeof statsRaw === 'object' && !Array.isArray(statsRaw)) {
    const fx = statsRaw.fixtures
    const goals = statsRaw.goals
    if (fx) {
      const played = fx.played?.total ?? 0
      const wins = fx.wins?.total ?? 0
      const draws = fx.draws?.total ?? 0
      const losses = fx.loses?.total ?? 0
      const gf = goals?.for?.total?.total ?? 0
      const ga = goals?.against?.total?.total ?? 0
      const cleanSheets = statsRaw?.clean_sheet?.total ?? 0
      seasonStats = {
        played,
        wins,
        draws,
        losses,
        goalsFor: gf,
        goalsAgainst: ga,
        goalsPerGame: played > 0 ? Number((gf / played).toFixed(2)) : 0,
        cleanSheets,
        leaguePosition: null, // filled in below if standings call succeeds
      }
    }
    if (statsRaw?.team?.name && !baseTeam.name) baseTeam.name = statsRaw.team.name
    // API-Football's /teams/statistics doesn't include league position. We'd
    // need a separate /standings call which adds a 4th-party round-trip.
    // For now leave as null — the standings text already lives in the main
    // coach prompt for the active league.
  }

  // Top scorer for this team — single derived call, cheap and additive.
  // Wrap in its own try so failures don't taint anything else.
  try {
    const scorers = await safeFetch(
      `/players/topscorers?league=${leagueId}&season=${season}`,
    )
    if (Array.isArray(scorers)) {
      for (const p of scorers) {
        const stat = p?.statistics?.[0]
        if (stat?.team?.id === teamId) {
          const name = p?.player?.name
          const goals = stat?.goals?.total
          if (typeof name === 'string') {
            topScorer = typeof goals === 'number' ? `${name} (${goals} goals)` : name
            break
          }
        }
      }
    }
  } catch {
    /* swallow */
  }

  // Final fallback for the team name so the prompt header is never blank.
  if (!baseTeam.name) baseTeam.name = `Team ${teamId}`

  const out: TeamDeepData = {
    team: baseTeam,
    injuries,
    last5,
    next5,
    seasonStats,
    topScorer,
  }
  cacheSet(cacheKey, out)
  return out
}

/**
 * Render a TeamDeepData block as a markdown-ish string ready to paste into
 * the AI system prompt. Empty sections are silently omitted.
 */
export function renderDeepDataBlock(d: TeamDeepData): string {
  const lines: string[] = []
  const leagueLabel = d.team.leagueName ? ` (${d.team.leagueName})` : ''
  lines.push(`🔬 DEEP DATA — ${d.team.name}${leagueLabel}`)

  if (d.seasonStats) {
    const s = d.seasonStats
    const posPart = s.leaguePosition ? `Position: ${s.leaguePosition} | ` : ''
    lines.push(
      `${posPart}${s.played}P · ${s.wins}W ${s.draws}D ${s.losses}L | ` +
        `${s.goalsFor} GF · ${s.goalsAgainst} GA | ` +
        `${s.goalsPerGame} g/game | ${s.cleanSheets} clean sheets`,
    )
  }

  if (d.last5.length > 0) {
    const formStr = d.last5
      .map(r => `${r.result} ${r.score} ${r.home} vs ${r.away} (${r.date})`)
      .join(' | ')
    lines.push(`Recent form (last 5): ${formStr}`)
  }

  if (d.next5.length > 0) {
    const fixturesStr = d.next5
      .map(f => `${f.home} vs ${f.away} (${f.date})`)
      .join(' | ')
    lines.push(`Next 5 fixtures: ${fixturesStr}`)
  }

  if (d.injuries.length > 0) {
    const inj = d.injuries
      .slice(0, 8)
      .map(i => `${i.player} (${i.reason})`)
      .join(' | ')
    lines.push(`Injuries: ${inj}`)
  } else {
    lines.push('Injuries: none reported')
  }

  if (d.topScorer) lines.push(`Top scorer: ${d.topScorer}`)

  return lines.join('\n')
}
