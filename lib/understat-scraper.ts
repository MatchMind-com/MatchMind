/**
 * lib/understat-scraper.ts
 *
 * Pulls team-level xG (expected goals) stats from Understat for the top 5
 * European leagues. Used as enrichment for the predictions endpoint — gives
 * GPT-4 real xG numbers instead of guessing them from form data.
 *
 * Why xG matters for predictions:
 *   - xG measures shot quality, not just shot quantity
 *   - Teams that consistently OUT-perform their xG are getting hot streaks;
 *     xG predicts regression to the mean
 *   - Teams that UNDER-perform their xG are unlucky; xG predicts mean-reversion
 *   - Bookies use xG, so any model that ignores it leaves edge on the table
 *
 * Data source: https://understat.com/getLeagueData/{LEAGUE}/{YEAR}
 *   Returns JSON with `teams`, `players`, `dates`. They tolerate respectful
 *   scraping; we send a browser-like UA + Referer to look like the JS client
 *   that normally hits this endpoint from their league page.
 *
 * Caching: in-memory per warm Vercel container, 24h TTL. League-level data
 * (one request per league per day) is plenty — we extract per-team stats
 * from that single response.
 *
 * Coverage: Premier League, La Liga, Bundesliga, Serie A, Ligue 1.
 * For any other league this returns null — caller falls back gracefully.
 *
 * Failure modes (all return null silently):
 *   - Network timeout (5s)
 *   - Cloudflare / bot block
 *   - JSON schema change
 *   - Team name mismatch (no fuzzy match found)
 */

// API-Football league name → Understat URL slug.
// Understat only covers these five leagues — for any other league we return
// null and the predictions endpoint just skips the xG enrichment step.
const LEAGUE_MAP: Record<string, string> = {
  'Premier League': 'EPL',
  'La Liga': 'La_liga',
  'Bundesliga': 'Bundesliga',
  'Serie A': 'Serie_A',
  'Ligue 1': 'Ligue_1',
}

const BASE = 'https://understat.com'
const TIMEOUT_MS = 5000

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json,*/*',
  'X-Requested-With': 'XMLHttpRequest',
  // Referer matches the JS client's call pattern — without it Understat
  // sometimes returns the HTML shell instead of JSON.
}

export type UnderstatTeamStats = {
  team: string
  matches: number
  // Season totals
  xG: number              // expected goals scored
  xGA: number             // expected goals against
  xPoints: number         // expected points based on xG
  goals: number           // actual goals scored
  goalsAgainst: number    // actual goals conceded
  // Per-game averages (most useful for the GPT prompt)
  xG_per_game: number
  xGA_per_game: number
  // Derived signals
  xg_diff: number                  // xG - xGA (positive = creating more chances than allowing)
  attack_overperformance: number   // goals - xG (positive = clinical OR lucky finishing → expect regression)
  defense_overperformance: number  // xGA - goalsAgainst (positive = strong GK / lucky → expect regression)
  // Last 5 games (recent form, not just season-long)
  last5_xG: number
  last5_xGA: number
}

export type UnderstatLeagueData = {
  league: string
  season: number
  fetchedAt: number
  teams: UnderstatTeamStats[]
}

// ── In-memory cache (per warm Vercel container) ─────────────────────────
// 24h TTL is plenty — Understat updates after each match day, and the
// predictions cron runs many times within that window.
const TTL_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, UnderstatLeagueData>()

function cacheKey(league: string, season: number): string {
  return `${league}:${season}`
}

function cacheGet(league: string, season: number): UnderstatLeagueData | null {
  const k = cacheKey(league, season)
  const entry = cache.get(k)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    cache.delete(k)
    return null
  }
  return entry
}

function cacheSet(data: UnderstatLeagueData): void {
  cache.set(cacheKey(data.league, data.season), data)
}

// ── Helpers ─────────────────────────────────────────────────────────────

function getCurrentSeason(): number {
  // Understat uses the start-year convention: 2025-26 season = 2025.
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 8 ? year : year - 1
}

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function normalizeTeamName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+(fc|cf|ac|sc)$/i, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function similarity(a: string, b: string): number {
  const an = normalizeTeamName(a)
  const bn = normalizeTeamName(b)
  if (!an || !bn) return 0
  if (an === bn) return 1
  if (an.includes(bn) || bn.includes(an)) return 0.85
  const aTokens = new Set(an.split(' '))
  const bTokens = new Set(bn.split(' '))
  let shared = 0
  aTokens.forEach((t) => {
    if (bTokens.has(t)) shared++
  })
  return shared / Math.max(aTokens.size, bTokens.size)
}

async function fetchJSON(url: string, referer: string): Promise<any | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, Referer: referer },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Returns season-aggregate xG stats for every team in the given league.
 * Cached per warm container for 24h. Returns null if the league isn't on
 * Understat or scraping failed for any reason.
 */
export async function getUnderstatLeagueStats(
  apiFootballLeagueName: string,
  season?: number,
): Promise<UnderstatLeagueData | null> {
  const understatLeague = LEAGUE_MAP[apiFootballLeagueName]
  if (!understatLeague) return null

  const yr = season ?? getCurrentSeason()
  const cached = cacheGet(understatLeague, yr)
  if (cached) return cached

  const json = await fetchJSON(
    `${BASE}/getLeagueData/${understatLeague}/${yr}`,
    `${BASE}/league/${understatLeague}/${yr}`,
  )
  if (!json || typeof json !== 'object') return null

  const teamsObj: Record<string, any> = json.teams ?? {}
  const teams: UnderstatTeamStats[] = []

  for (const id of Object.keys(teamsObj)) {
    const t = teamsObj[id]
    if (!t || typeof t !== 'object') continue
    const history: any[] = Array.isArray(t.history) ? t.history : []
    if (history.length === 0) continue

    const sums = history.reduce(
      (acc, m) => ({
        xG: acc.xG + (Number(m.xG) || 0),
        xGA: acc.xGA + (Number(m.xGA) || 0),
        xPoints: acc.xPoints + (Number(m.xpts) || 0),
        scored: acc.scored + (Number(m.scored) || 0),
        missed: acc.missed + (Number(m.missed) || 0),
      }),
      { xG: 0, xGA: 0, xPoints: 0, scored: 0, missed: 0 },
    )
    const matches = history.length

    // Recent-form snapshot: last 5 games
    const last5 = history.slice(-5).reduce(
      (acc, m) => ({
        xG: acc.xG + (Number(m.xG) || 0),
        xGA: acc.xGA + (Number(m.xGA) || 0),
      }),
      { xG: 0, xGA: 0 },
    )

    teams.push({
      team: String(t.title || ''),
      matches,
      xG: r2(sums.xG),
      xGA: r2(sums.xGA),
      xPoints: r2(sums.xPoints),
      xG_per_game: r2(sums.xG / matches),
      xGA_per_game: r2(sums.xGA / matches),
      goals: sums.scored,
      goalsAgainst: sums.missed,
      xg_diff: r2(sums.xG - sums.xGA),
      attack_overperformance: r2(sums.scored - sums.xG),
      defense_overperformance: r2(sums.xGA - sums.missed),
      last5_xG: r2(last5.xG),
      last5_xGA: r2(last5.xGA),
    })
  }

  if (teams.length === 0) return null

  const data: UnderstatLeagueData = {
    league: understatLeague,
    season: yr,
    fetchedAt: Date.now(),
    teams,
  }
  cacheSet(data)
  return data
}

/**
 * Look up a single team's xG stats by name. Fuzzy matches against
 * Understat's team naming (which often differs from API-Football's, e.g.
 * "Wolverhampton Wanderers" vs "Wolves").
 *
 * Returns null if the league isn't covered, scraping failed, or no team
 * matched well enough (similarity threshold 0.5).
 */
export async function getUnderstatTeamStats(
  teamName: string,
  apiFootballLeagueName: string,
  season?: number,
): Promise<UnderstatTeamStats | null> {
  const league = await getUnderstatLeagueStats(apiFootballLeagueName, season)
  if (!league) return null

  let best: { team: UnderstatTeamStats; score: number } | null = null
  for (const t of league.teams) {
    const score = similarity(teamName, t.team)
    if (score >= 0.5 && (!best || score > best.score)) {
      best = { team: t, score }
    }
  }
  return best?.team ?? null
}

/**
 * Convenience: enrich a fixture (home + away) with both teams' xG stats in
 * one call. Returns nulls when the league isn't covered or one/both teams
 * couldn't be matched. Always resolves — never throws.
 */
export async function getUnderstatFixtureStats(
  homeTeam: string,
  awayTeam: string,
  apiFootballLeagueName: string,
  season?: number,
): Promise<{ home: UnderstatTeamStats | null; away: UnderstatTeamStats | null }> {
  const [home, away] = await Promise.all([
    getUnderstatTeamStats(homeTeam, apiFootballLeagueName, season),
    getUnderstatTeamStats(awayTeam, apiFootballLeagueName, season),
  ])
  return { home, away }
}

/** True if the league is covered by Understat (top 5 European). */
export function isUnderstatLeague(apiFootballLeagueName: string): boolean {
  return apiFootballLeagueName in LEAGUE_MAP
}
