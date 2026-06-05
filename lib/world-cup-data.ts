/**
 * lib/world-cup-data.ts
 *
 * Shared World Cup 2026 data fetcher — used by /world-cup, the per-group
 * SEO pages at /world-cup/groups/[group], and the per-team SEO pages
 * at /world-cup/teams/[team].
 *
 * Caches per-deploy via Next.js fetch revalidate. The draw is locked, so
 * 1-hour revalidate is overly cautious but cheap.
 */

const API_KEY = process.env.API_FOOTBALL_KEY!
const API_BASE = 'https://v3.football.api-sports.io'

export interface WCTeam {
  id: number
  name: string
  logo: string
}

export interface WCFixture {
  id: number
  date: string
  venue: { city: string | null; name: string | null }
  round: string
  home: WCTeam
  away: WCTeam
}

export interface WCGroup {
  name: string         // "Group A" .. "Group L"
  letter: string       // "A" .. "L"
  slug: string         // "a" .. "l" — URL-safe
  teams: WCTeam[]
  fixtures: WCFixture[]
}

export interface WCTeamProfile {
  team: WCTeam
  group: WCGroup
  fixtures: WCFixture[]   // only this team's fixtures, sorted by date
  slug: string            // URL-safe team slug
}

/** URL-safe slug for a team / group name. */
export function teamSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function groupSlug(name: string): string {
  // "Group A" -> "a"
  const m = name.match(/Group\s+(\w)/i)
  return m ? m[1].toLowerCase() : name.toLowerCase()
}

async function fetchFixtures(): Promise<WCFixture[]> {
  try {
    const res = await fetch(`${API_BASE}/fixtures?league=1&season=2026`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.response ?? []).map((f: any) => ({
      id: f.fixture?.id,
      date: f.fixture?.date,
      venue: { city: f.fixture?.venue?.city ?? null, name: f.fixture?.venue?.name ?? null },
      round: f.league?.round ?? '?',
      home: { id: f.teams?.home?.id, name: f.teams?.home?.name, logo: f.teams?.home?.logo },
      away: { id: f.teams?.away?.id, name: f.teams?.away?.name, logo: f.teams?.away?.logo },
    }))
  } catch {
    return []
  }
}

async function fetchStandings(): Promise<Map<string, WCTeam[]>> {
  try {
    const res = await fetch(`${API_BASE}/standings?league=1&season=2026`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return new Map()
    const json = await res.json()
    const leagues = json.response ?? []
    if (!leagues[0]?.league?.standings) return new Map()
    const map = new Map<string, WCTeam[]>()
    for (const groupRows of leagues[0].league.standings) {
      if (!Array.isArray(groupRows) || groupRows.length === 0) continue
      const groupName: string = groupRows[0].group
      if (!groupName?.startsWith('Group ')) continue
      map.set(
        groupName,
        groupRows.map((r: any) => ({
          id: r.team?.id,
          name: r.team?.name,
          logo: r.team?.logo,
        })),
      )
    }
    return map
  } catch {
    return new Map()
  }
}

/**
 * Returns all 12 World Cup groups with their teams and fixtures.
 * Source of truth for SEO pages — calling this once per page request
 * is cheap since both underlying API calls are revalidate-cached.
 */
export async function getWorldCupGroups(): Promise<WCGroup[]> {
  const [fixtures, standings] = await Promise.all([fetchFixtures(), fetchStandings()])

  // Build team → group lookup so we can bucket fixtures correctly
  const teamIdToGroup = new Map<number, string>()
  for (const [groupName, teams] of standings.entries()) {
    for (const t of teams) teamIdToGroup.set(t.id, groupName)
  }

  return Array.from(standings.entries())
    .map(([name, teams]): WCGroup => {
      const groupFixtures = fixtures
        .filter(f => teamIdToGroup.get(f.home.id) === name || teamIdToGroup.get(f.away.id) === name)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const letter = name.replace(/^Group\s+/i, '')
      return {
        name,
        letter,
        slug: groupSlug(name),
        teams,
        fixtures: groupFixtures,
      }
    })
    .sort((a, b) => a.letter.localeCompare(b.letter))
}

/** Find a group by URL slug (case-insensitive). */
export async function getGroupBySlug(slug: string): Promise<WCGroup | null> {
  const groups = await getWorldCupGroups()
  const normalized = slug.toLowerCase()
  return groups.find(g => g.slug === normalized) ?? null
}

/** All group-stage fixtures across every group, flat list. */
export async function getAllFixtures(): Promise<WCFixture[]> {
  const groups = await getWorldCupGroups()
  const out: WCFixture[] = []
  const seen = new Set<number>()
  for (const g of groups) {
    for (const f of g.fixtures) {
      if (!seen.has(f.id)) {
        seen.add(f.id)
        out.push(f)
      }
    }
  }
  return out.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/** Find a single fixture by API-Football fixture id, with its group context. */
export async function getFixtureById(id: number): Promise<{ fixture: WCFixture; group: WCGroup } | null> {
  const groups = await getWorldCupGroups()
  for (const group of groups) {
    const fixture = group.fixtures.find(f => f.id === id)
    if (fixture) return { fixture, group }
  }
  return null
}

/** All 48 teams (one per group × 4) with their group + fixtures. */
export async function getAllTeams(): Promise<WCTeamProfile[]> {
  const groups = await getWorldCupGroups()
  const profiles: WCTeamProfile[] = []
  for (const group of groups) {
    for (const team of group.teams) {
      const teamFixtures = group.fixtures
        .filter(f => f.home.id === team.id || f.away.id === team.id)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      profiles.push({
        team,
        group,
        fixtures: teamFixtures,
        slug: teamSlug(team.name),
      })
    }
  }
  return profiles
}

/** Find a team profile by URL slug. */
export async function getTeamBySlug(slug: string): Promise<WCTeamProfile | null> {
  const profiles = await getAllTeams()
  const normalized = slug.toLowerCase()
  return profiles.find(p => p.slug === normalized) ?? null
}

/* ────────────────────────────────────────────────────────────
 * Team enrichment — form, squad, injuries
 *
 * Used by /world-cup/teams/[team] to add real editorial content
 * beyond just fixtures. Each enrichment fetch is independent so a
 * failure in one (e.g. no squad data for a smaller nation) doesn't
 * blank the page.
 * ────────────────────────────────────────────────────────────── */

export interface RecentFixture {
  date: string                     // ISO
  opponent: string                 // team name
  isHome: boolean
  goalsFor: number | null
  goalsAgainst: number | null
  result: 'W' | 'L' | 'D' | '?'
}

export interface SquadPlayer {
  id: number
  name: string
  position: 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker' | string
  age: number | null
  number: number | null
}

export interface InjuryReport {
  player: string
  reason: string
  type: string                     // "Missing Fixture" | "Questionable" | ...
}

export interface TeamEnrichment {
  form: RecentFixture[]            // most recent first
  squad: SquadPlayer[]             // all positions
  injuries: InjuryReport[]
}

async function fetchLastFixtures(teamId: number, n = 5): Promise<RecentFixture[]> {
  try {
    const res = await fetch(`${API_BASE}/fixtures?team=${teamId}&last=${n}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.response ?? []).map((f: any): RecentFixture => {
      const isHome = f.teams?.home?.id === teamId
      const us = isHome ? f.goals?.home : f.goals?.away
      const them = isHome ? f.goals?.away : f.goals?.home
      const opponent = (isHome ? f.teams?.away?.name : f.teams?.home?.name) ?? '?'
      let result: 'W' | 'L' | 'D' | '?' = '?'
      if (typeof us === 'number' && typeof them === 'number') {
        result = us > them ? 'W' : us < them ? 'L' : 'D'
      }
      return {
        date: f.fixture?.date ?? '',
        opponent,
        isHome,
        goalsFor: typeof us === 'number' ? us : null,
        goalsAgainst: typeof them === 'number' ? them : null,
        result,
      }
    })
  } catch {
    return []
  }
}

async function fetchSquad(teamId: number): Promise<SquadPlayer[]> {
  try {
    const res = await fetch(`${API_BASE}/players/squads?team=${teamId}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 3600 * 24 },   // squad rarely changes — 24h cache
    })
    if (!res.ok) return []
    const json = await res.json()
    const players = json.response?.[0]?.players ?? []
    return players.map((p: any): SquadPlayer => ({
      id: p.id,
      name: p.name,
      position: p.position ?? 'Unknown',
      age: typeof p.age === 'number' ? p.age : null,
      number: typeof p.number === 'number' ? p.number : null,
    }))
  } catch {
    return []
  }
}

async function fetchInjuries(teamId: number): Promise<InjuryReport[]> {
  try {
    // Some nations don't run a domestic season call — calendar 2026 covers
    // both WC + post-club-season friendlies.
    const res = await fetch(`${API_BASE}/injuries?team=${teamId}&season=2026`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const json = await res.json()
    const seen = new Set<string>()
    const out: InjuryReport[] = []
    for (const i of json.response ?? []) {
      const name = i.player?.name
      if (!name || seen.has(name)) continue
      seen.add(name)
      out.push({
        player: name,
        reason: i.player?.reason ?? 'Unknown',
        type: i.player?.type ?? 'Missing Fixture',
      })
    }
    return out
  } catch {
    return []
  }
}

export async function getTeamEnrichment(teamId: number): Promise<TeamEnrichment> {
  const [form, squad, injuries] = await Promise.all([
    fetchLastFixtures(teamId, 5),
    fetchSquad(teamId),
    fetchInjuries(teamId),
  ])
  return { form, squad, injuries }
}
