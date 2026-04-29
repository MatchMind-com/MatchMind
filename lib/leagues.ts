/**
 * Single source of truth for the 25 competitions MatchMind tracks.
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
}

export const TRACKED_LEAGUES: readonly TrackedLeague[] = [
  // ── Tier 1: Top European leagues + UEFA competitions ───────────────────
  { id: 39,  name: 'Premier League',         country: 'England',       flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', tier: 1 },
  { id: 140, name: 'La Liga',                country: 'Spain',         flag: '🇪🇸', tier: 1 },
  { id: 135, name: 'Serie A',                country: 'Italy',         flag: '🇮🇹', tier: 1 },
  { id: 78,  name: 'Bundesliga',             country: 'Germany',       flag: '🇩🇪', tier: 1 },
  { id: 61,  name: 'Ligue 1',                country: 'France',        flag: '🇫🇷', tier: 1 },
  { id: 2,   name: 'UEFA Champions League',  country: 'Europe',        flag: '🏆', tier: 1 },
  { id: 3,   name: 'UEFA Europa League',     country: 'Europe',        flag: '🥈', tier: 1 },
  { id: 848, name: 'UEFA Conference League', country: 'Europe',        flag: '🥉', tier: 1 },

  // ── Tier 2: Mid-tier European + N. American ────────────────────────────
  { id: 88,  name: 'Eredivisie',             country: 'Netherlands',   flag: '🇳🇱', tier: 2 },
  { id: 94,  name: 'Primeira Liga',          country: 'Portugal',      flag: '🇵🇹', tier: 2 },
  { id: 203, name: 'Süper Lig',              country: 'Turkey',        flag: '🇹🇷', tier: 2 },
  { id: 40,  name: 'Championship',           country: 'England',       flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', tier: 2 },
  { id: 144, name: 'Pro League',             country: 'Belgium',       flag: '🇧🇪', tier: 2 },
  { id: 113, name: 'Allsvenskan',            country: 'Sweden',        flag: '🇸🇪', tier: 2 },
  { id: 262, name: 'Liga MX',                country: 'Mexico',        flag: '🇲🇽', tier: 2 },
  { id: 253, name: 'MLS',                    country: 'USA',           flag: '🇺🇸', tier: 2 },

  // ── Tier 3: South America, Asia, smaller European, World Cup ──────────
  { id: 71,  name: 'Brasileirão',            country: 'Brazil',        flag: '🇧🇷', tier: 3 },
  { id: 128, name: 'Argentine Primera',      country: 'Argentina',     flag: '🇦🇷', tier: 3 },
  { id: 13,  name: 'Copa Libertadores',      country: 'South America', flag: '🏆', tier: 3 },
  { id: 11,  name: 'Copa Sudamericana',      country: 'South America', flag: '🥈', tier: 3 },
  { id: 307, name: 'Saudi Pro League',       country: 'Saudi Arabia',  flag: '🇸🇦', tier: 3 },
  { id: 98,  name: 'J1 League',              country: 'Japan',         flag: '🇯🇵', tier: 3 },
  { id: 179, name: 'Scottish Premiership',   country: 'Scotland',      flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', tier: 3 },
  { id: 106, name: 'Ekstraklasa',            country: 'Poland',        flag: '🇵🇱', tier: 3 },
  { id: 1,   name: 'World Cup',              country: 'World',         flag: '🌍', tier: 3 },
] as const

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
 * AI system prompt. The AI then knows it has access to all 25 — and won't
 * say "sorry, I don't cover Saudi" when the user asks about Al-Hilal.
 *
 * Output looks like:
 *   "MatchMind tracks 25 competitions across Europe, Americas, Asia, and the Middle East:
 *    Premier League (England), La Liga (Spain), Serie A (Italy), ...
 *    When the user mentions any of these, you can pull live fixtures, standings,
 *    odds, predictions, and team stats. Never claim a league is unsupported."
 */
export function leaguesPromptBlock(): string {
  const list = TRACKED_LEAGUES
    .map(l => `${l.name} (${l.country})`)
    .join(', ')

  return `MatchMind tracks ${TRACKED_LEAGUES.length} competitions across Europe, the Americas, Asia and the Middle East: ${list}. When the user mentions any of these — including the Saudi Pro League, UEFA Conference League, J1 League, Liga MX, Scottish Premiership, etc. — you DO have access to fixtures, standings, odds, predictions, team form and head-to-head data for them. Never tell the user a league is unsupported. If the live data block above doesn't already contain stats for that league, say "let me pull that up" and answer from your training knowledge with the explicit caveat that detailed live stats may take a moment to load.`
}

/**
 * Renders a compact list of leagues as a comma-separated string, useful when
 * you want a shorter mention (e.g. for the live-copilot system prompt where
 * tokens are tighter).
 */
export function leaguesShortList(): string {
  return TRACKED_LEAGUES.map(l => l.name).join(', ')
}
