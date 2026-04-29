/**
 * lib/team-resolver — resolve free-text team names to API-Football team IDs.
 *
 * Used by the AI Coach to detect team mentions in a user message ("how is
 * Galatasaray doing?") and then pull deep data (form, injuries, fixtures,
 * stats) for that exact team across any of MatchMind's 25 tracked leagues.
 *
 * Strategy:
 * 1. KNOWN_TEAMS hardcoded map of ~100 popular teams — instant, no API call.
 * 2. Fallback to API-Football /teams?search=NAME with a 5s timeout.
 * 3. Module-level cache keyed by lowercased query — names don't change.
 *
 * All functions are defensive: timeouts, no throws, returns null on failure.
 */
import { findLeague } from '@/lib/leagues'

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'
const TIMEOUT_MS = 5000

export type TeamMatch = {
  id: number
  name: string
  leagueId: number | null
  leagueName: string | null
  country: string | null
  logo: string
}

/**
 * Hardcoded fast-path: the most popular teams across the 25 tracked leagues.
 * Keys are lowercased aliases the user might type; values are the canonical
 * API-Football team id and league context.
 *
 * IDs verified against API-Football v3. When in doubt the resolver will still
 * fall back to /teams?search and find them — this map just skips the API call
 * for the obvious cases.
 */
type KnownTeam = { id: number; name: string; leagueId: number; aliases: string[] }

const KNOWN_TEAMS: KnownTeam[] = [
  // ── Premier League (39) ───────────────────────────────────────────────
  { id: 33,  name: 'Manchester United', leagueId: 39, aliases: ['manchester united', 'man utd', 'man united', 'manutd', 'mufc', 'united'] },
  { id: 34,  name: 'Newcastle',         leagueId: 39, aliases: ['newcastle', 'newcastle united', 'nufc', 'magpies'] },
  { id: 35,  name: 'Bournemouth',       leagueId: 39, aliases: ['bournemouth', 'afc bournemouth'] },
  { id: 36,  name: 'Fulham',            leagueId: 39, aliases: ['fulham'] },
  { id: 39,  name: 'Wolves',            leagueId: 39, aliases: ['wolves', 'wolverhampton'] },
  { id: 40,  name: 'Liverpool',         leagueId: 39, aliases: ['liverpool', 'lfc', 'reds'] },
  { id: 41,  name: 'Southampton',       leagueId: 39, aliases: ['southampton', 'saints'] },
  { id: 42,  name: 'Arsenal',           leagueId: 39, aliases: ['arsenal', 'gunners', 'afc'] },
  { id: 44,  name: 'Burnley',           leagueId: 39, aliases: ['burnley'] },
  { id: 45,  name: 'Everton',           leagueId: 39, aliases: ['everton', 'toffees'] },
  { id: 46,  name: 'Leicester',         leagueId: 39, aliases: ['leicester', 'leicester city', 'foxes'] },
  { id: 47,  name: 'Tottenham',         leagueId: 39, aliases: ['tottenham', 'spurs', 'thfc', 'hotspur'] },
  { id: 48,  name: 'West Ham',          leagueId: 39, aliases: ['west ham', 'hammers', 'whufc'] },
  { id: 49,  name: 'Chelsea',           leagueId: 39, aliases: ['chelsea', 'cfc', 'blues'] },
  { id: 50,  name: 'Manchester City',   leagueId: 39, aliases: ['manchester city', 'man city', 'mancity', 'mcfc', 'city'] },
  { id: 51,  name: 'Brighton',          leagueId: 39, aliases: ['brighton', 'brighton hove albion', 'seagulls'] },
  { id: 52,  name: 'Crystal Palace',    leagueId: 39, aliases: ['crystal palace', 'palace', 'cpfc'] },
  { id: 55,  name: 'Brentford',         leagueId: 39, aliases: ['brentford', 'bees'] },
  { id: 57,  name: 'Nottingham Forest', leagueId: 39, aliases: ['nottingham forest', 'forest', 'nffc'] },
  { id: 66,  name: 'Aston Villa',       leagueId: 39, aliases: ['aston villa', 'villa', 'avfc'] },

  // ── La Liga (140) ──────────────────────────────────────────────────────
  { id: 529, name: 'Barcelona',         leagueId: 140, aliases: ['barcelona', 'barca', 'fc barcelona', 'fcb'] },
  { id: 530, name: 'Atletico Madrid',   leagueId: 140, aliases: ['atletico madrid', 'atletico', 'atleti', 'atm', 'atlético'] },
  { id: 531, name: 'Athletic Bilbao',   leagueId: 140, aliases: ['athletic bilbao', 'athletic club', 'bilbao'] },
  { id: 532, name: 'Valencia',          leagueId: 140, aliases: ['valencia', 'valencia cf'] },
  { id: 533, name: 'Villarreal',        leagueId: 140, aliases: ['villarreal', 'yellow submarine'] },
  { id: 536, name: 'Sevilla',           leagueId: 140, aliases: ['sevilla', 'sevilla fc'] },
  { id: 538, name: 'Celta Vigo',        leagueId: 140, aliases: ['celta vigo', 'celta'] },
  { id: 541, name: 'Real Madrid',       leagueId: 140, aliases: ['real madrid', 'madrid', 'rmcf', 'los blancos'] },
  { id: 543, name: 'Real Betis',        leagueId: 140, aliases: ['real betis', 'betis'] },
  { id: 546, name: 'Getafe',            leagueId: 140, aliases: ['getafe'] },
  { id: 548, name: 'Real Sociedad',     leagueId: 140, aliases: ['real sociedad', 'la real'] },

  // ── Serie A (135) ──────────────────────────────────────────────────────
  { id: 487, name: 'Lazio',             leagueId: 135, aliases: ['lazio', 'ss lazio'] },
  { id: 488, name: 'Sassuolo',          leagueId: 135, aliases: ['sassuolo'] },
  { id: 489, name: 'Milan',             leagueId: 135, aliases: ['milan', 'ac milan', 'rossoneri'] },
  { id: 492, name: 'Napoli',            leagueId: 135, aliases: ['napoli', 'ssc napoli'] },
  { id: 494, name: 'Udinese',           leagueId: 135, aliases: ['udinese'] },
  { id: 496, name: 'Juventus',          leagueId: 135, aliases: ['juventus', 'juve', 'old lady'] },
  { id: 497, name: 'Roma',              leagueId: 135, aliases: ['roma', 'as roma', 'giallorossi'] },
  { id: 499, name: 'Atalanta',          leagueId: 135, aliases: ['atalanta'] },
  { id: 500, name: 'Bologna',           leagueId: 135, aliases: ['bologna'] },
  { id: 502, name: 'Fiorentina',        leagueId: 135, aliases: ['fiorentina', 'viola'] },
  { id: 503, name: 'Torino',            leagueId: 135, aliases: ['torino', 'toro'] },
  { id: 505, name: 'Inter',             leagueId: 135, aliases: ['inter', 'inter milan', 'internazionale', 'nerazzurri'] },

  // ── Bundesliga (78) ────────────────────────────────────────────────────
  { id: 157, name: 'Bayern Munich',     leagueId: 78,  aliases: ['bayern munich', 'bayern', 'fc bayern', 'fcb münchen'] },
  { id: 165, name: 'Borussia Dortmund', leagueId: 78,  aliases: ['borussia dortmund', 'dortmund', 'bvb'] },
  { id: 168, name: 'Bayer Leverkusen',  leagueId: 78,  aliases: ['bayer leverkusen', 'leverkusen', 'die werkself'] },
  { id: 169, name: 'Eintracht Frankfurt', leagueId: 78, aliases: ['eintracht frankfurt', 'frankfurt', 'eintracht', 'sge'] },
  { id: 172, name: 'VfB Stuttgart',     leagueId: 78,  aliases: ['stuttgart', 'vfb stuttgart'] },
  { id: 173, name: 'RB Leipzig',        leagueId: 78,  aliases: ['rb leipzig', 'leipzig'] },
  { id: 182, name: 'Union Berlin',      leagueId: 78,  aliases: ['union berlin'] },

  // ── Ligue 1 (61) ───────────────────────────────────────────────────────
  { id: 79,  name: 'Lille',             leagueId: 61,  aliases: ['lille', 'losc'] },
  { id: 80,  name: 'Lyon',              leagueId: 61,  aliases: ['lyon', 'olympique lyonnais', 'ol'] },
  { id: 81,  name: 'Marseille',         leagueId: 61,  aliases: ['marseille', 'olympique marseille', 'om'] },
  { id: 84,  name: 'Nice',              leagueId: 61,  aliases: ['nice', 'ogc nice'] },
  { id: 85,  name: 'Paris Saint Germain', leagueId: 61, aliases: ['psg', 'paris saint germain', 'paris saint-germain', 'paris sg', 'paris'] },
  { id: 91,  name: 'Monaco',            leagueId: 61,  aliases: ['monaco', 'as monaco'] },
  { id: 94,  name: 'Rennes',            leagueId: 61,  aliases: ['rennes', 'stade rennais'] },

  // ── Süper Lig (203) ────────────────────────────────────────────────────
  { id: 645, name: 'Galatasaray',       leagueId: 203, aliases: ['galatasaray', 'gala', 'cim bom', 'cimbom'] },
  { id: 611, name: 'Fenerbahce',        leagueId: 203, aliases: ['fenerbahce', 'fenerbahçe', 'fener', 'fb'] },
  { id: 549, name: 'Besiktas',          leagueId: 203, aliases: ['besiktas', 'beşiktaş', 'bjk', 'kara kartal'] },
  { id: 998, name: 'Trabzonspor',       leagueId: 203, aliases: ['trabzonspor', 'trabzon'] },
  { id: 564, name: 'Basaksehir',        leagueId: 203, aliases: ['basaksehir', 'başakşehir', 'istanbul basaksehir'] },
  { id: 1004, name: 'Adana Demirspor',  leagueId: 203, aliases: ['adana demirspor', 'adana'] },
  { id: 1009, name: 'Antalyaspor',      leagueId: 203, aliases: ['antalyaspor', 'antalya'] },
  { id: 1010, name: 'Konyaspor',        leagueId: 203, aliases: ['konyaspor', 'konya'] },

  // ── Eredivisie (88) ────────────────────────────────────────────────────
  { id: 194, name: 'Ajax',              leagueId: 88,  aliases: ['ajax', 'afc ajax'] },
  { id: 197, name: 'PSV Eindhoven',     leagueId: 88,  aliases: ['psv', 'psv eindhoven'] },
  { id: 209, name: 'Feyenoord',         leagueId: 88,  aliases: ['feyenoord'] },

  // ── Primeira Liga (94) ─────────────────────────────────────────────────
  { id: 211, name: 'Benfica',           leagueId: 94,  aliases: ['benfica', 'sl benfica'] },
  { id: 212, name: 'Porto',             leagueId: 94,  aliases: ['porto', 'fc porto'] },
  { id: 228, name: 'Sporting CP',       leagueId: 94,  aliases: ['sporting cp', 'sporting lisbon', 'sporting'] },

  // ── Scottish Premiership (179) ────────────────────────────────────────
  { id: 247, name: 'Celtic',            leagueId: 179, aliases: ['celtic', 'celtic fc', 'bhoys'] },
  { id: 257, name: 'Rangers',           leagueId: 179, aliases: ['rangers', 'rangers fc', 'gers'] },

  // ── Saudi Pro League (307) ────────────────────────────────────────────
  { id: 2939, name: 'Al-Nassr',         leagueId: 307, aliases: ['al-nassr', 'al nassr', 'alnassr', 'nassr'] },
  { id: 2932, name: 'Al-Hilal',         leagueId: 307, aliases: ['al-hilal', 'al hilal', 'alhilal', 'hilal'] },
  { id: 2938, name: 'Al-Ittihad',       leagueId: 307, aliases: ['al-ittihad', 'al ittihad', 'ittihad'] },
  { id: 2934, name: 'Al-Ahli',          leagueId: 307, aliases: ['al-ahli', 'al ahli', 'alahli'] },

  // ── J1 League (98) ─────────────────────────────────────────────────────
  { id: 286, name: 'Yokohama F. Marinos', leagueId: 98, aliases: ['yokohama marinos', 'yokohama f marinos', 'marinos'] },
  { id: 295, name: 'Kawasaki Frontale', leagueId: 98,  aliases: ['kawasaki frontale', 'kawasaki'] },
  { id: 287, name: 'Kashima Antlers',   leagueId: 98,  aliases: ['kashima antlers', 'kashima'] },

  // ── MLS (253) ──────────────────────────────────────────────────────────
  { id: 1616, name: 'Inter Miami',      leagueId: 253, aliases: ['inter miami', 'miami cf', 'inter miami cf'] },
  { id: 1604, name: 'LA Galaxy',        leagueId: 253, aliases: ['la galaxy', 'galaxy'] },
  { id: 1605, name: 'Los Angeles FC',   leagueId: 253, aliases: ['lafc', 'los angeles fc'] },

  // ── Liga MX (262) ──────────────────────────────────────────────────────
  { id: 2279, name: 'Club America',     leagueId: 262, aliases: ['club america', 'america', 'aguilas'] },
  { id: 2278, name: 'Tigres UANL',      leagueId: 262, aliases: ['tigres', 'tigres uanl'] },
  { id: 2287, name: 'Monterrey',        leagueId: 262, aliases: ['monterrey', 'rayados'] },

  // ── Brasileirão (71) ──────────────────────────────────────────────────
  { id: 124, name: 'Flamengo',          leagueId: 71,  aliases: ['flamengo', 'fla', 'mengão'] },
  { id: 126, name: 'Sao Paulo',         leagueId: 71,  aliases: ['sao paulo', 'são paulo', 'spfc'] },
  { id: 127, name: 'Palmeiras',         leagueId: 71,  aliases: ['palmeiras', 'verdão'] },
  { id: 121, name: 'Corinthians',       leagueId: 71,  aliases: ['corinthians', 'timão'] },

  // ── Argentine Primera (128) ───────────────────────────────────────────
  { id: 451, name: 'River Plate',       leagueId: 128, aliases: ['river plate', 'river', 'el millonario'] },
  { id: 435, name: 'Boca Juniors',      leagueId: 128, aliases: ['boca juniors', 'boca', 'xeneize'] },

  // ── Championship (40) ─────────────────────────────────────────────────
  { id: 62,  name: 'Leeds',             leagueId: 40,  aliases: ['leeds', 'leeds united', 'lufc'] },
  { id: 63,  name: 'Norwich',           leagueId: 40,  aliases: ['norwich', 'norwich city'] },
  { id: 71,  name: 'Sunderland',        leagueId: 40,  aliases: ['sunderland', 'safc', 'black cats'] },

  // ── Belgian Pro League (144) ──────────────────────────────────────────
  { id: 569, name: 'Club Brugge',       leagueId: 144, aliases: ['club brugge', 'brugge'] },
  { id: 554, name: 'Anderlecht',        leagueId: 144, aliases: ['anderlecht', 'rsc anderlecht'] },

  // ── Polish Ekstraklasa (106) ─────────────────────────────────────────
  { id: 327, name: 'Legia Warsaw',      leagueId: 106, aliases: ['legia warsaw', 'legia', 'legia warszawa'] },
]

// ── Fast lookup index built once at module load ──────────────────────────
const ALIAS_INDEX = new Map<string, KnownTeam>()
for (const t of KNOWN_TEAMS) {
  for (const a of t.aliases) ALIAS_INDEX.set(a, t)
}

// Module-level cache: free-text query (lowercased) → resolved match.
// Names don't change so no expiry; bounded soft-cap to avoid unbounded growth.
const resolveCache = new Map<string, TeamMatch | null>()
const RESOLVE_CACHE_MAX = 500

function cacheSet(key: string, value: TeamMatch | null): void {
  if (resolveCache.size >= RESOLVE_CACHE_MAX) {
    // Evict oldest insertion (Map preserves insertion order).
    const firstKey = resolveCache.keys().next().value
    if (firstKey !== undefined) resolveCache.delete(firstKey)
  }
  resolveCache.set(key, value)
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Build a TeamMatch from a known-teams entry. */
function fromKnown(t: KnownTeam): TeamMatch {
  const lge = findLeague(t.leagueId)
  return {
    id: t.id,
    name: t.name,
    leagueId: t.leagueId,
    leagueName: lge?.name ?? null,
    country: lge?.country ?? null,
    logo: `https://media.api-sports.io/football/teams/${t.id}.png`,
  }
}

/** Best-effort fetch with timeout; returns parsed JSON or null. */
async function safeFetch(path: string): Promise<any | null> {
  if (!API_KEY) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      signal: controller.signal,
      next: { revalidate: 3600 }, // team metadata barely changes
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

/**
 * Resolve a free-text team name to an API-Football team id + league context.
 * Tries the in-memory KNOWN_TEAMS map first, then falls back to /teams?search.
 * Returns null if nothing reasonable matches.
 */
export async function resolveTeam(query: string): Promise<TeamMatch | null> {
  if (!query || typeof query !== 'string') return null
  const normQuery = normalize(query)
  if (!normQuery) return null

  if (resolveCache.has(normQuery)) return resolveCache.get(normQuery) ?? null

  // 1. Direct alias hit
  const direct = ALIAS_INDEX.get(normQuery)
  if (direct) {
    const m = fromKnown(direct)
    cacheSet(normQuery, m)
    return m
  }

  // 2. Substring scan — does any known alias appear in the query, or vice versa?
  // Prefer the longest alias match so "manchester city" wins over "manchester".
  let best: KnownTeam | null = null
  let bestLen = 0
  for (const [alias, team] of ALIAS_INDEX) {
    if (alias.length < 4) continue // skip short ambiguous tokens
    if (normQuery.includes(alias) && alias.length > bestLen) {
      best = team
      bestLen = alias.length
    }
  }
  if (best) {
    const m = fromKnown(best)
    cacheSet(normQuery, m)
    return m
  }

  // 3. Fall back to API-Football search (5s timeout, single call)
  try {
    const encoded = encodeURIComponent(query.trim())
    const arr = await safeFetch(`/teams?search=${encoded}`)
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0]
      const teamId = first?.team?.id
      const teamName = first?.team?.name
      if (typeof teamId === 'number' && typeof teamName === 'string') {
        const country = first?.team?.country ?? null
        const logo = first?.team?.logo ?? `https://media.api-sports.io/football/teams/${teamId}.png`
        const match: TeamMatch = {
          id: teamId,
          name: teamName,
          leagueId: null,
          leagueName: null,
          country,
          logo,
        }
        cacheSet(normQuery, match)
        return match
      }
    }
  } catch {
    // swallow — never throw from the resolver
  }

  cacheSet(normQuery, null)
  return null
}

/**
 * Detect team names mentioned in arbitrary text. Returns up to 3 unique matches.
 *
 * Strategy:
 *  - Scan the normalised text for KNOWN_TEAMS aliases (case-insensitive substring).
 *  - Prefer longer aliases — "manchester city" beats "manchester".
 *  - De-duplicate by team id (so a single team isn't returned twice).
 *  - Cap at 3 to keep deep-data fan-out bounded.
 *
 * Pure local detection — no API calls. Stays well under 100ms.
 */
export async function detectTeams(text: string): Promise<TeamMatch[]> {
  if (!text || typeof text !== 'string') return []
  const norm = ' ' + normalize(text) + ' '
  if (!norm.trim()) return []

  type Hit = { team: KnownTeam; index: number; length: number }
  const hits: Hit[] = []

  for (const t of KNOWN_TEAMS) {
    let bestIdx = -1
    let bestLen = 0
    for (const alias of t.aliases) {
      if (alias.length < 3) continue
      // word-boundary-ish match: surround alias with spaces so we don't match
      // "fc" inside "fcc". We pre-padded `norm` above.
      const needle = ' ' + alias + ' '
      const idx = norm.indexOf(needle)
      if (idx >= 0 && alias.length > bestLen) {
        bestIdx = idx
        bestLen = alias.length
      }
    }
    if (bestIdx >= 0) hits.push({ team: t, index: bestIdx, length: bestLen })
  }

  if (hits.length === 0) return []

  // Resolve overlap: if "manchester city" matched at idx X with len L, drop any
  // shorter alias whose match falls inside [X, X+L]. Sort by start asc, then
  // length desc, so the longer alias is kept.
  hits.sort((a, b) => a.index - b.index || b.length - a.length)
  const kept: Hit[] = []
  for (const h of hits) {
    const overlapping = kept.some(k =>
      h.index < k.index + k.length && k.index < h.index + h.length
    )
    if (!overlapping) kept.push(h)
  }

  // De-dupe by team id, preserve order, cap at 3.
  const seen = new Set<number>()
  const out: TeamMatch[] = []
  for (const h of kept) {
    if (seen.has(h.team.id)) continue
    seen.add(h.team.id)
    out.push(fromKnown(h.team))
    if (out.length >= 3) break
  }
  return out
}
