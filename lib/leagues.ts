/**
 * Single source of truth for the 50 competitions MatchMind tracks.
 *
 * Used by:
 * - /api/cron/refresh-predictions (and the tier1/2/3 wrappers) to know which
 *   leagues to fetch fixtures + odds for.
 * - All AI routes (/api/coach-with-data, /api/live-copilot, /api/live-copilot/chat)
 *   to inject league awareness into the system prompt — so the AI never
 *   pretends it can't see Saudi Pro League / Conference / J1 etc.
 *
 * IDs match API-Football v3 league ids.
 */

export type TrackedLeague = {
  id: number
  name: string
  country: string
  flag: string
  tier: 1 | 2 | 3
  /**
   * Which season-numbering convention API-Football uses for this league.
   *
   * - 'european' (default): season runs Aug → May, identified by the
   *   start year. The 2025-26 Premier League season = season=2025.
   * - 'calendar': competition happens within a single calendar year,
   *   identified by that year. The 2026 World Cup = season=2026, the
   *   2026 Brazilian Brasileirão = season=2026, etc.
   *
   * Set 'calendar' for: all international tournaments (WC, Euro, Copa
   * America, AFCON, Friendlies), South American competitions
   * (Brasileirão, Argentine Primera, Copa Libertadores, Copa Sudamericana,
   * Copa do Brasil, Copa Argentina), North American (MLS, Liga MX,
   * CONCACAF CCC), Asian (J1, AFC CL), and Nordic summer leagues
   * (Allsvenskan, Eliteserien).
   *
   * Bug history: before this field existed, the cron asked for the wrong
   * season for ~12 of the 50 tracked leagues. In June 2026 it queried
   * season=2025 for everything, so friendlies (real season=2026) returned
   * 0 fixtures and the entire pre-World Cup window had no picks.
   */
  seasonType?: 'european' | 'calendar'
}

export const TRACKED_LEAGUES: readonly TrackedLeague[] = [
  // ── Tier 1: Top European leagues + UEFA + major domestic cups ──────────
  { id: 39,  name: 'Premier League',         country: 'England',       flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', tier: 1 },
  { id: 140, name: 'La Liga',                country: 'Spain',         flag: '🇪🇸', tier: 1 },
  { id: 135, name: 'Serie A',                country: 'Italy',         flag: '🇮🇹', tier: 1 },
  { id: 78,  name: 'Bundesliga',             country: 'Germany',       flag: '🇩🇪', tier: 1 },
  { id: 61,  name: 'Ligue 1',                country: 'France',        flag: '🇫🇷', tier: 1 },
  { id: 2,   name: 'UEFA Champions League',  country: 'Europe',        flag: '🏆', tier: 1 },
  { id: 3,   name: 'UEFA Europa League',     country: 'Europe',        flag: '🥈', tier: 1 },
  { id: 848, name: 'UEFA Europa Conference League', country: 'Europe', flag: '🥉', tier: 1 },
  { id: 45,  name: 'FA Cup',                 country: 'England',       flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', tier: 1 },
  { id: 48,  name: 'EFL Cup',                country: 'England',       flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', tier: 1 },
  { id: 81,  name: 'DFB Pokal',              country: 'Germany',       flag: '🇩🇪', tier: 1 },
  { id: 137, name: 'Coppa Italia',           country: 'Italy',         flag: '🇮🇹', tier: 1 },
  { id: 143, name: 'Copa del Rey',           country: 'Spain',         flag: '🇪🇸', tier: 1 },
  { id: 66,  name: 'Coupe de France',        country: 'France',        flag: '🇫🇷', tier: 1 },

  // ── Tier 2: Mid-tier European + N. American + 2nd divisions ────────────
  { id: 88,  name: 'Eredivisie',             country: 'Netherlands',   flag: '🇳🇱', tier: 2 },
  { id: 94,  name: 'Primeira Liga',          country: 'Portugal',      flag: '🇵🇹', tier: 2 },
  { id: 203, name: 'Süper Lig',              country: 'Turkey',        flag: '🇹🇷', tier: 2 },
  { id: 40,  name: 'Championship',           country: 'England',       flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', tier: 2 },
  { id: 144, name: 'Pro League',             country: 'Belgium',       flag: '🇧🇪', tier: 2 },
  { id: 113, name: 'Allsvenskan',            country: 'Sweden',        flag: '🇸🇪', tier: 2, seasonType: 'calendar' },
  { id: 262, name: 'Liga MX',                country: 'Mexico',        flag: '🇲🇽', tier: 2, seasonType: 'calendar' },
  { id: 253, name: 'MLS',                    country: 'USA',           flag: '🇺🇸', tier: 2, seasonType: 'calendar' },
  { id: 79,  name: 'Bundesliga 2',           country: 'Germany',       flag: '🇩🇪', tier: 2 },
  { id: 136, name: 'Serie B',                country: 'Italy',         flag: '🇮🇹', tier: 2 },
  { id: 141, name: 'Segunda División',       country: 'Spain',         flag: '🇪🇸', tier: 2 },
  { id: 62,  name: 'Ligue 2',                country: 'France',        flag: '🇫🇷', tier: 2 },
  { id: 41,  name: 'League One',             country: 'England',       flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', tier: 2 },
  { id: 119, name: 'Danish Superliga',       country: 'Denmark',       flag: '🇩🇰', tier: 2 },
  { id: 103, name: 'Eliteserien',            country: 'Norway',        flag: '🇳🇴', tier: 2, seasonType: 'calendar' },
  { id: 197, name: 'Super League 1',         country: 'Greece',        flag: '🇬🇷', tier: 2 },
  { id: 218, name: 'Bundesliga (Austria)',   country: 'Austria',       flag: '🇦🇹', tier: 2 },
  { id: 207, name: 'Super League',           country: 'Switzerland',   flag: '🇨🇭', tier: 2 },

  // ── Tier 3: South America, Asia, intl + smaller European ──────────────
  { id: 71,  name: 'Brasileirão',            country: 'Brazil',        flag: '🇧🇷', tier: 3, seasonType: 'calendar' },
  { id: 128, name: 'Argentine Primera',      country: 'Argentina',     flag: '🇦🇷', tier: 3, seasonType: 'calendar' },
  { id: 13,  name: 'Copa Libertadores',      country: 'South America', flag: '🏆', tier: 3, seasonType: 'calendar' },
  { id: 11,  name: 'Copa Sudamericana',      country: 'South America', flag: '🥈', tier: 3, seasonType: 'calendar' },
  { id: 307, name: 'Saudi Pro League',       country: 'Saudi Arabia',  flag: '🇸🇦', tier: 3 },
  { id: 98,  name: 'J1 League',              country: 'Japan',         flag: '🇯🇵', tier: 3, seasonType: 'calendar' },
  { id: 179, name: 'Scottish Premiership',   country: 'Scotland',      flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', tier: 3 },
  { id: 106, name: 'Ekstraklasa',            country: 'Poland',        flag: '🇵🇱', tier: 3 },
  { id: 1,   name: 'World Cup',              country: 'World',         flag: '🌍', tier: 3, seasonType: 'calendar' },
  { id: 9,   name: 'Copa America',           country: 'South America', flag: '🏆', tier: 3, seasonType: 'calendar' },
  { id: 6,   name: 'Africa Cup of Nations',  country: 'Africa',        flag: '🌍', tier: 3, seasonType: 'calendar' },
  { id: 17,  name: 'AFC Champions League',   country: 'Asia',          flag: '🏆', tier: 3, seasonType: 'calendar' },
  { id: 16,  name: 'CONCACAF Champions Cup', country: 'N. America',    flag: '🏆', tier: 3, seasonType: 'calendar' },
  { id: 4,   name: 'Euro Championship',      country: 'Europe',        flag: '🇪🇺', tier: 3, seasonType: 'calendar' },
  { id: 10,  name: 'Friendlies (Intl)',      country: 'World',         flag: '🌍', tier: 3, seasonType: 'calendar' },
  { id: 73,  name: 'Copa do Brasil',         country: 'Brazil',        flag: '🇧🇷', tier: 3, seasonType: 'calendar' },
  { id: 130, name: 'Copa Argentina',         country: 'Argentina',     flag: '🇦🇷', tier: 3, seasonType: 'calendar' },
  { id: 188, name: 'A-League',               country: 'Australia',     flag: '🇦🇺', tier: 3 },
] as const

/**
 * Compute the correct API-Football season number for a given league, based
 * on its season-numbering convention:
 *
 * - European leagues (Aug → May): season = start year. So in Mar 2026,
 *   the Premier League is still season=2025 (the 2025-26 season).
 * - Calendar leagues (single calendar year): season = current year.
 *
 * This function fixes a long-standing bug where the cron used a single
 * year for all leagues — getting 0 fixtures for friendlies / WC / MLS /
 * Brasileirão etc. for ~6 months out of every 12.
 */
export function getSeasonForLeague(league: { seasonType?: 'european' | 'calendar' }): number {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const year = now.getFullYear()
  if (league.seasonType === 'calendar') {
    return year
  }
  // European default: Aug-May. After August → current calendar year.
  // Before August → previous calendar year (we're still in the season
  // that started last August).
  return month >= 8 ? year : year - 1
}

/**
 * Filter the central list down to a tier (1, 2, or 3).
 * Returns a fresh array, safe to mutate by callers.
 */
export function leaguesByTier(tier: 1 | 2 | 3): TrackedLeague[] {
  return TRACKED_LEAGUES.filter(l => l.tier === tier).map(l => ({ ...l }))
}

/**
 * All tracked leagues as a fresh, mutable array.
 */
export function allLeagues(): TrackedLeague[] {
  return TRACKED_LEAGUES.map(l => ({ ...l }))
}

/**
 * Quick lookup by API-Football league id.
 */
export function findLeague(id: number | string): TrackedLeague | null {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id
  if (Number.isNaN(numId)) return null
  return TRACKED_LEAGUES.find(l => l.id === numId) || null
}

/**
 * Renders the master league list as a single text block to drop into an
 * AI system prompt. The AI then knows it has access to ALL tracked
 * competitions — and won't say "sorry, I don't cover Saudi" when the user
 * asks about Al-Hilal.
 *
 * Output looks like:
 *   "MatchMind tracks 50 competitions across Europe, Americas, Asia, Africa and Oceania:
 *    Premier League (England), La Liga (Spain), Serie A (Italy), ...
 *    When the user mentions any of these, you can pull live fixtures, standings,
 *    odds, predictions, and team stats. Never claim a league is unsupported."
 */
export function leaguesPromptBlock(): string {
  const list = TRACKED_LEAGUES
    .map(l => `${l.name} (${l.country})`)
    .join(', ')

  return `MatchMind tracks ${TRACKED_LEAGUES.length} competitions across Europe, the Americas, Asia, Africa, the Middle East and Oceania: ${list}. When the user mentions any of these — including the Saudi Pro League, UEFA Conference League, J1 League, Liga MX, Scottish Premiership, A-League, AFC Champions League, Copa do Brasil, Copa Argentina, FA Cup, Coppa Italia, etc. — you DO have access to fixtures, standings, odds, predictions, team form and head-to-head data for them. Never tell the user a league is unsupported. If the live data block above doesn't already contain stats for that league, say "let me pull that up" and answer from your training knowledge with the explicit caveat that detailed live stats may take a moment to load.`
}

/**
 * Renders a compact list of leagues as a comma-separated string, useful when
 * you want a shorter mention (e.g. for the live-copilot system prompt where
 * tokens are tighter).
 */
export function leaguesShortList(): string {
  return TRACKED_LEAGUES.map(l => l.name).join(', ')
}
