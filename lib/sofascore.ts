/**
 * lib/sofascore — unofficial SofaScore client.
 *
 * Used as a fallback for live match stats when API-Football returns null
 * (common on lower-tier leagues). SofaScore covers nearly every league
 * with shots, xG, possession, corners, momentum, etc.
 *
 * No auth required — these endpoints back the SofaScore mobile app.
 * We send a browser-like User-Agent because requests without one are blocked.
 *
 * All functions are defensive: timeouts, no throws on 4xx/5xx, null fields
 * when data is missing.
 */

const BASE = 'https://api.sofascore.com/api/v1'
const TIMEOUT_MS = 5000

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.sofascore.com/',
}

export type SofaScoreStats = {
  matchId: number | null
  shots: { home: number | null; away: number | null }
  shotsOnTarget: { home: number | null; away: number | null }
  xg: { home: number | null; away: number | null }
  possession: { home: number | null; away: number | null }
  corners: { home: number | null; away: number | null }
  fouls: { home: number | null; away: number | null }
  attacks: { home: number | null; away: number | null }
  dangerousAttacks: { home: number | null; away: number | null }
  offsides: { home: number | null; away: number | null }
  saves: { home: number | null; away: number | null }
  passAccuracy: { home: number | null; away: number | null }
  yellowCards: { home: number; away: number }
  redCards: { home: number; away: number }
  momentum: number[] | null
}

// Module-level cache: <homeAway> → matchId. Search only happens once per match.
const matchIdCache = new Map<string, number | null>()

function emptyStats(matchId: number | null = null): SofaScoreStats {
  return {
    matchId,
    shots: { home: null, away: null },
    shotsOnTarget: { home: null, away: null },
    xg: { home: null, away: null },
    possession: { home: null, away: null },
    corners: { home: null, away: null },
    fouls: { home: null, away: null },
    attacks: { home: null, away: null },
    dangerousAttacks: { home: null, away: null },
    offsides: { home: null, away: null },
    saves: { home: null, away: null },
    passAccuracy: { home: null, away: null },
    yellowCards: { home: 0, away: 0 },
    redCards: { home: 0, away: 0 },
    momentum: null,
  }
}

async function safeFetch(url: string): Promise<any | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: HEADERS,
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

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function similarity(a: string, b: string): number {
  const an = normalize(a)
  const bn = normalize(b)
  if (!an || !bn) return 0
  if (an === bn) return 1
  if (an.includes(bn) || bn.includes(an)) return 0.8
  const aTokens = new Set(an.split(' '))
  const bTokens = new Set(bn.split(' '))
  let shared = 0
  aTokens.forEach((t) => {
    if (bTokens.has(t)) shared++
  })
  return shared / Math.max(aTokens.size, bTokens.size)
}

export async function findSofaScoreMatchId(
  homeTeam: string,
  awayTeam: string,
): Promise<number | null> {
  const key = `${normalize(homeTeam)}__${normalize(awayTeam)}`
  if (matchIdCache.has(key)) return matchIdCache.get(key) ?? null

  const query = encodeURIComponent(`${homeTeam} ${awayTeam}`)
  const json = await safeFetch(
    `${BASE}/search/event-suggester?q=${query}&sport=football`,
  )

  // Suggester result shape varies; events may be at .results[].entity or .events
  const candidates: any[] = []
  const results = json?.results || json?.events || []
  for (const r of results) {
    const ev = r?.entity || r
    if (ev && (ev.homeTeam || ev.awayTeam)) candidates.push(ev)
  }

  let best: { id: number; score: number } | null = null
  for (const c of candidates) {
    const ch = c?.homeTeam?.name || ''
    const ca = c?.awayTeam?.name || ''
    const s = similarity(homeTeam, ch) + similarity(awayTeam, ca)
    if (s >= 1.2 && (!best || s > best.score)) {
      const id = Number(c.id)
      if (Number.isFinite(id)) best = { id, score: s }
    }
  }

  const matchId = best?.id ?? null
  matchIdCache.set(key, matchId)
  return matchId
}

function num(v: any): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const cleaned = v.replace('%', '').trim()
    const n = parseFloat(cleaned)
    return Number.isFinite(n) ? n : null
  }
  return null
}

// Map SofaScore stat keys/names to our shape. Keys vary across endpoints —
// match by lowercase `key` first, then by `name` substring.
function mapStatItem(name: string, key: string): keyof SofaScoreStats | null {
  const k = (key || '').toLowerCase()
  const n = (name || '').toLowerCase()
  if (k === 'expected_goals' || n.includes('expected goals')) return 'xg'
  if (k === 'ball_possession' || n.includes('ball possession')) return 'possession'
  if (k === 'total_shots' || n === 'total shots' || n.includes('total shots')) return 'shots'
  if (k === 'shots_on_goal' || k === 'shots_on_target' || n.includes('shots on target') || n.includes('shots on goal')) return 'shotsOnTarget'
  if (k === 'corner_kicks' || n.includes('corner')) return 'corners'
  if (k === 'fouls' || n === 'fouls') return 'fouls'
  if (k === 'total_attacks' || n === 'attacks') return 'attacks'
  if (k === 'dangerous_attacks' || n.includes('dangerous attack')) return 'dangerousAttacks'
  if (k === 'offsides' || n === 'offsides') return 'offsides'
  if (k === 'goalkeeper_saves' || k === 'saves' || n.includes('saves')) return 'saves'
  if (k === 'accurate_passes' || n.includes('pass accuracy') || n.includes('passes accurate')) return 'passAccuracy'
  return null
}

async function fetchStatistics(matchId: number, out: SofaScoreStats): Promise<void> {
  const json = await safeFetch(`${BASE}/event/${matchId}/statistics`)
  const periods: any[] = json?.statistics || []
  // Prefer the "ALL" period
  const all = periods.find((p) => p?.period === 'ALL') || periods[0]
  if (!all) return
  const groups: any[] = all.groups || []
  for (const g of groups) {
    const items: any[] = g?.statisticsItems || []
    for (const it of items) {
      const target = mapStatItem(it?.name || '', it?.key || '')
      if (!target) continue
      const home = num(it?.home)
      const away = num(it?.away)
      // pass-accuracy: SofaScore returns "423/501 (84%)" style; num() yields 423.
      // Prefer percentage-style values.
      if (target === 'passAccuracy') {
        const homeStr = String(it?.home ?? '')
        const awayStr = String(it?.away ?? '')
        const hPct = homeStr.match(/\((\d+)%\)/)
        const aPct = awayStr.match(/\((\d+)%\)/)
        out.passAccuracy.home = hPct ? parseFloat(hPct[1]) : home
        out.passAccuracy.away = aPct ? parseFloat(aPct[1]) : away
        continue
      }
      const slot = out[target] as { home: number | null; away: number | null }
      if (slot && typeof slot === 'object' && 'home' in slot) {
        if (slot.home === null) slot.home = home
        if (slot.away === null) slot.away = away
      }
    }
  }
}

async function fetchIncidents(
  matchId: number,
  out: SofaScoreStats,
  homeIsHome: boolean,
): Promise<void> {
  const json = await safeFetch(`${BASE}/event/${matchId}/incidents`)
  const incidents: any[] = json?.incidents || []
  for (const inc of incidents) {
    const cls = (inc?.incidentClass || '').toLowerCase()
    const isHome = homeIsHome ? inc?.isHome === true : inc?.isHome === false
    const sideHome = inc?.isHome === true
    if (cls === 'yellow') {
      if (sideHome) out.yellowCards.home++
      else out.yellowCards.away++
    } else if (cls === 'red' || cls === 'redcard' || cls === 'yellowred') {
      if (sideHome) out.redCards.home++
      else out.redCards.away++
    }
    void isHome
  }
}

async function fetchMomentum(matchId: number, out: SofaScoreStats): Promise<void> {
  const json = await safeFetch(`${BASE}/event/${matchId}/graph/momentum`)
  const points: any[] = json?.graphPoints || json?.points || []
  if (Array.isArray(points) && points.length > 0) {
    const values = points
      .map((p) => num(p?.value))
      .filter((v): v is number => v !== null)
    out.momentum = values.length > 0 ? values.slice(-90) : null
  }
}

export async function getSofaScoreStats(matchId: number): Promise<SofaScoreStats> {
  const out = emptyStats(matchId)
  await Promise.all([
    fetchStatistics(matchId, out),
    fetchIncidents(matchId, out, true),
    fetchMomentum(matchId, out),
  ])
  return out
}

export async function getSofaScoreLiveStats(
  homeTeam: string,
  awayTeam: string,
): Promise<SofaScoreStats> {
  const id = await findSofaScoreMatchId(homeTeam, awayTeam)
  if (id === null) return emptyStats(null)
  return getSofaScoreStats(id)
}

// ── Lineups ──────────────────────────────────────────────────────────
//
// SofaScore covers lineups for nearly every league API-Football misses —
// notably Saudi Pro League, J1, Liga MX, Eredivisie reserves, etc.
// Used as a fallback in /api/fixtures/[fixtureId] when API-Football
// returns no lineup data.

export type SofaScorePlayer = {
  id: number
  name: string
  number: number | null
  pos: string | null
  rating?: number | null
}

export type SofaScoreLineup = {
  team_name: string | null
  formation: string | null
  coach: string | null
  starting_xi: SofaScorePlayer[]
  substitutes: SofaScorePlayer[]
}

function processSofaSide(side: any, teamName: string | null): SofaScoreLineup | null {
  if (!side) return null
  const players: any[] = Array.isArray(side.players) ? side.players : []
  const startingXI: SofaScorePlayer[] = []
  const substitutes: SofaScorePlayer[] = []
  for (const p of players) {
    const player: SofaScorePlayer = {
      id: Number(p?.player?.id ?? 0),
      name: String(p?.player?.name ?? p?.player?.shortName ?? '—'),
      number: typeof p?.shirtNumber === 'number' ? p.shirtNumber : (typeof p?.player?.shirtNumber === 'number' ? p.player.shirtNumber : null),
      pos: p?.position ?? p?.player?.position ?? null,
      rating: typeof p?.statistics?.rating === 'number' ? p.statistics.rating : null,
    }
    if (p?.substitute) substitutes.push(player)
    else startingXI.push(player)
  }
  return {
    team_name: teamName,
    formation: side?.formation ?? null,
    coach: side?.coach?.name ?? null,
    starting_xi: startingXI,
    substitutes,
  }
}

export async function getSofaScoreLineups(
  matchId: number,
  homeName?: string,
  awayName?: string,
): Promise<{ home: SofaScoreLineup | null; away: SofaScoreLineup | null }> {
  const json = await safeFetch(`${BASE}/event/${matchId}/lineups`)
  if (!json) return { home: null, away: null }
  return {
    home: processSofaSide(json.home, homeName ?? null),
    away: processSofaSide(json.away, awayName ?? null),
  }
}

export async function getSofaScoreLineupsForMatch(
  homeTeam: string,
  awayTeam: string,
): Promise<{ home: SofaScoreLineup | null; away: SofaScoreLineup | null; matchId: number | null }> {
  const id = await findSofaScoreMatchId(homeTeam, awayTeam)
  if (id === null) return { home: null, away: null, matchId: null }
  const lineups = await getSofaScoreLineups(id, homeTeam, awayTeam)
  return { ...lineups, matchId: id }
}
