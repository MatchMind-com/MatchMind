/**
 * Shared live-bet evaluation utilities.
 *
 * Used by:
 *   - /api/bet-slips/[id]/live-legs   — per-leg detail for one acca
 *   - /api/bet-slips/my-live          — home page "my live bets" feed
 *
 * Keeps the team-name fuzzy matcher and the per-pick "is this winning"
 * logic in ONE place so both endpoints stay consistent.
 */

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

export const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO'] as const
export const IN_PLAY_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'] as const
export const NOT_STARTED_STATUSES = ['NS', 'TBD'] as const

export type LegState =
  | 'pending'
  | 'cashing'
  | 'losing'
  | 'won'
  | 'lost'
  | 'tbd'
  | 'void'

export interface AccaLeg {
  match_name: string
  selection: string
  odds: number
  league?: string | null
  match_date?: string | null
  bet_type?: string | null
  result?: 'win' | 'loss' | 'void' | 'pending'
}

// ─── API-Football fetch ────────────────────────────────────────────

export async function apiFetch(path: string): Promise<any[] | null> {
  if (!API_KEY) return null
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 30 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json?.response ?? null
  } catch {
    return null
  }
}

// ─── Acca-leg notes parser ─────────────────────────────────────────

export function parseAccaLegs(notes: string | null | undefined): AccaLeg[] | null {
  if (!notes) return null
  for (const line of notes.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) continue
    try {
      const obj = JSON.parse(trimmed)
      if (obj?.kind === 'acca_legs_v1' && Array.isArray(obj.legs)) {
        return obj.legs as AccaLeg[]
      }
    } catch {
      // continue
    }
  }
  return null
}

// ─── Team-name fuzzy match ─────────────────────────────────────────

export function normTeam(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(fc|cf|ac|sc|sk|fk|cd|de|club|f\.c\.)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function teamMatches(slipName: string, fxName: string): number {
  const a = normTeam(slipName)
  const b = normTeam(fxName)
  if (!a || !b) return 0
  if (a === b) return 100
  if (a.includes(b) || b.includes(a)) return 80
  const ta = new Set(a.split(' '))
  const tb = new Set(b.split(' '))
  let overlap = 0
  for (const t of ta) if (tb.has(t)) overlap++
  if (overlap === 0) return 0
  return Math.round((overlap / Math.max(ta.size, tb.size)) * 70)
}

export function matchFixture(fixtures: any[], matchName: string): any | null {
  const parts = matchName.split(/\s+vs?\.?\s+|\s+v\s+|\s+-\s+/i)
  if (parts.length < 2) return null
  const slipHome = parts[0].trim()
  const slipAway = parts[1].trim()
  let bestFx: any = null
  let bestScore = 0
  for (const fx of fixtures) {
    const fxHome = fx?.teams?.home?.name ?? ''
    const fxAway = fx?.teams?.away?.name ?? ''
    if (!fxHome || !fxAway) continue
    const direct = teamMatches(slipHome, fxHome) + teamMatches(slipAway, fxAway)
    const swapped = teamMatches(slipHome, fxAway) + teamMatches(slipAway, fxHome)
    const score = Math.max(direct, swapped)
    if (score > bestScore && score >= 100) {
      bestScore = score
      bestFx = fx
    }
  }
  return bestFx
}

// ─── Pick evaluator ────────────────────────────────────────────────

export interface PickEvaluation {
  state: LegState
  label: string
  context?: string
}

export function evaluatePick(
  selection: string,
  betType: string | null | undefined,
  fx: any
): PickEvaluation {
  const status = fx?.fixture?.status?.short ?? 'NS'
  const home = Number(fx?.goals?.home ?? 0) || 0
  const away = Number(fx?.goals?.away ?? 0) || 0
  const homeName = fx?.teams?.home?.name ?? 'Home'
  const awayName = fx?.teams?.away?.name ?? 'Away'
  const halftimeHome = Number(fx?.score?.halftime?.home ?? 0) || 0
  const halftimeAway = Number(fx?.score?.halftime?.away ?? 0) || 0
  const finished = (FINISHED_STATUSES as readonly string[]).includes(status)
  const live = (IN_PLAY_STATUSES as readonly string[]).includes(status)
  const notStarted =
    (NOT_STARTED_STATUSES as readonly string[]).includes(status) ||
    status === 'PST' ||
    status === 'CANC'

  if (notStarted) return { state: 'pending', label: 'Not started' }

  const sel = selection.toLowerCase()
  const bt = (betType ?? '').toLowerCase()

  const liveCash = (winning: boolean): PickEvaluation =>
    winning
      ? { state: 'cashing', label: 'Cashing', context: `${homeName} ${home}-${away} ${awayName}` }
      : { state: 'losing', label: 'Behind', context: `${homeName} ${home}-${away} ${awayName}` }
  const settle = (winning: boolean): PickEvaluation =>
    winning
      ? { state: 'won', label: 'Won', context: `${homeName} ${home}-${away} ${awayName}` }
      : { state: 'lost', label: 'Lost', context: `${homeName} ${home}-${away} ${awayName}` }

  // ── Helpers for team-name detection inside selection text ──────
  // Bookies print Double Chance picks as "X or Liverpool" / "Arsenal or
  // Newcastle" / "Liverpool or X" — not in the canonical 1X/X2/12 form.
  // We detect which team is on which side by fuzzy matching the name.
  const homeNorm = normTeam(homeName)
  const awayNorm = normTeam(awayName)
  const selNorm = normTeam(selection)
  // Each token sequence in selection that looks like a team mention
  const mentionsHome = !!homeNorm && (selNorm.includes(homeNorm) || tokensOverlap(selNorm, homeNorm) >= 60)
  const mentionsAway = !!awayNorm && (selNorm.includes(awayNorm) || tokensOverlap(selNorm, awayNorm) >= 60)

  // ── Match-result family (1X2) ──────────────────────────────────
  const isExplicitDraw = /\bdraw\b/.test(sel) || sel.trim() === 'x'
  const isHomePick =
    /\bhome\b/.test(sel) ||
    sel.startsWith('1 ') || sel === '1' ||
    (mentionsHome && !mentionsAway && !isExplicitDraw && !sel.includes(' or '))
  const isAwayPick =
    /\baway\b/.test(sel) ||
    sel.startsWith('2 ') || sel === '2' ||
    (mentionsAway && !mentionsHome && !isExplicitDraw && !sel.includes(' or '))

  if (bt.includes('match result') || bt.includes('1x2') || /win$|to win/.test(sel) || (!sel.includes(' or ') && (mentionsHome !== mentionsAway))) {
    if (isHomePick) return finished ? settle(home > away) : liveCash(home > away)
    if (isAwayPick) return finished ? settle(away > home) : liveCash(away > home)
    if (isExplicitDraw && !sel.includes(' or ')) return finished ? settle(home === away) : liveCash(home === away)
  }

  // ── Double Chance ──────────────────────────────────────────────
  // Recognise canonical (1X / X2 / 12) AND bookie-style ("X or Arsenal",
  // "Liverpool or X", "Liverpool or Arsenal") by inspecting which entities
  // appear on each side of " or ".
  const isDoubleChance =
    bt.includes('double chance') ||
    /\b(1x|x2|12)\b/.test(sel) ||
    /\bor\b/.test(sel)
  if (isDoubleChance) {
    const homeOrDraw = home >= away
    const drawOrAway = away >= home
    const eitherWin = home !== away

    // Canonical 1X / X2 / 12 strings first.
    if (sel.includes('1x') || sel.includes('home/draw') || sel.includes('home or draw')) {
      return finished ? settle(homeOrDraw) : liveCash(homeOrDraw)
    }
    if (sel.includes('x2') || sel.includes('draw/away') || sel.includes('draw or away')) {
      return finished ? settle(drawOrAway) : liveCash(drawOrAway)
    }
    if (sel.includes('12') || sel.includes('home/away') || sel.includes('either')) {
      return finished ? settle(eitherWin) : liveCash(eitherWin)
    }

    // "X or [team]" / "[team] or X" — Draw + one specific side.
    if (/\bx\b/.test(sel) && / or /.test(sel)) {
      if (mentionsHome) return finished ? settle(homeOrDraw) : liveCash(homeOrDraw)
      if (mentionsAway) return finished ? settle(drawOrAway) : liveCash(drawOrAway)
    }
    // "[home] or [away]" — both teams, so 12 (either win).
    if (mentionsHome && mentionsAway) {
      return finished ? settle(eitherWin) : liveCash(eitherWin)
    }
  }

  // ── Over/Under family ──────────────────────────────────────────
  const ouMatch = sel.match(/(over|under)\s*([\d.]+)/i)
  if (ouMatch) {
    const side = ouMatch[1].toLowerCase()
    const line = parseFloat(ouMatch[2])
    const totalGoals = home + away
    if (side === 'over') {
      if (totalGoals > line) {
        return { state: 'won', label: finished ? 'Won' : 'Already cashed', context: `${totalGoals} goals already` }
      }
      if (finished) return settle(false)
      return { state: 'losing', label: 'Behind', context: `${totalGoals} of ${line + 0.5} goals` }
    } else {
      if (totalGoals > line) {
        return { state: 'lost', label: finished ? 'Lost' : 'Already lost', context: `${totalGoals} goals scored` }
      }
      if (finished) return settle(true)
      return { state: 'cashing', label: 'Cashing', context: `${totalGoals} of max ${line - 0.5} goals` }
    }
  }

  // ── BTTS family ────────────────────────────────────────────────
  if (sel.includes('btts') || bt.includes('both teams') || sel.includes('both teams')) {
    const yes = sel.includes('yes') || (!sel.includes('no') && bt.includes('yes'))
    const both = home > 0 && away > 0
    if (yes) {
      if (both) return { state: 'won', label: finished ? 'Won' : 'Already cashed', context: 'Both scored' }
      if (finished) return settle(false)
      return { state: 'losing', label: 'Behind', context: `${homeName} ${home}-${away} ${awayName}` }
    } else {
      if (both) return { state: 'lost', label: finished ? 'Lost' : 'Already lost', context: 'Both teams scored' }
      if (finished) return settle(true)
      return { state: 'cashing', label: 'Holding', context: `${homeName} ${home}-${away} ${awayName}` }
    }
  }

  // ── Half Time Result ───────────────────────────────────────────
  // Needs API-Football's `score.halftime`. Treat HT as "settled" once the
  // game is past HT (i.e. status is 2H, ET, FT, etc.).
  if (bt.includes('half time') || bt.includes('halftime') || /\bht\b/.test(sel)) {
    const htReached = ['HT', '2H', 'ET', 'BT', 'P', 'INT'].includes(status) || finished
    const htHomeWin = halftimeHome > halftimeAway
    const htAwayWin = halftimeAway > halftimeHome
    const htDraw = halftimeHome === halftimeAway
    const ctx = `HT ${halftimeHome}-${halftimeAway}`
    if (mentionsHome || /\bhome\b/.test(sel)) {
      return htReached ? { state: htHomeWin ? 'won' : 'lost', label: htHomeWin ? 'Won' : 'Lost', context: ctx } : liveCash(home > away)
    }
    if (mentionsAway || /\baway\b/.test(sel)) {
      return htReached ? { state: htAwayWin ? 'won' : 'lost', label: htAwayWin ? 'Won' : 'Lost', context: ctx } : liveCash(away > home)
    }
    if (/\bdraw\b/.test(sel) || sel.trim() === 'x') {
      return htReached ? { state: htDraw ? 'won' : 'lost', label: htDraw ? 'Won' : 'Lost', context: ctx } : liveCash(home === away)
    }
  }

  // ── Win to Nil ─────────────────────────────────────────────────
  if (bt.includes('win to nil') || sel.includes('to nil') || sel.includes('to win to nil')) {
    const homeNil = home > away && away === 0
    const awayNil = away > home && home === 0
    if (mentionsHome || /\bhome\b/.test(sel)) {
      if (away > 0) return { state: finished ? 'lost' : 'lost', label: finished ? 'Lost' : 'Already lost', context: `${awayName} scored` }
      return finished ? settle(homeNil) : liveCash(home > 0 && away === 0)
    }
    if (mentionsAway || /\baway\b/.test(sel)) {
      if (home > 0) return { state: finished ? 'lost' : 'lost', label: finished ? 'Lost' : 'Already lost', context: `${homeName} scored` }
      return finished ? settle(awayNil) : liveCash(away > 0 && home === 0)
    }
  }

  // ── Asian Handicap (basic) ─────────────────────────────────────
  // Selection like "Liverpool -1.5" / "Arsenal +0.5". We assume integer
  // and half-integer lines (no quarter-line splits — those settle two
  // ways and are bookie-specific). For half-line, Win/Lose only; for
  // integer line, push/Win/Lose (we treat push as "void").
  const ahMatch = sel.match(/([+-])\s*(\d+(?:\.\d+)?)/)
  if (ahMatch && (bt.includes('handicap') || bt.includes('ah') || /\b(handicap|ah)\b/.test(sel))) {
    const sign = ahMatch[1] === '+' ? 1 : -1
    const line = sign * parseFloat(ahMatch[2])
    const teamIsHome = mentionsHome
    const teamIsAway = mentionsAway && !mentionsHome
    if (teamIsHome || teamIsAway) {
      const teamScore = teamIsHome ? home : away
      const oppScore = teamIsHome ? away : home
      const adjustedDiff = (teamScore + line) - oppScore
      if (Math.abs(adjustedDiff) < 0.001) {
        return finished ? { state: 'void', label: 'Push (void)' } : liveCash(false)
      }
      return finished ? settle(adjustedDiff > 0) : liveCash(adjustedDiff > 0)
    }
  }

  // ── Fallback ───────────────────────────────────────────────────
  if (live) return { state: 'tbd', label: 'In play', context: `${homeName} ${home}-${away} ${awayName}` }
  if (finished) return { state: 'tbd', label: 'Settled — check slip', context: `${homeName} ${home}-${away} ${awayName}` }
  return { state: 'pending', label: 'Pending' }
}

/** Token-overlap percent score used by `mentionsHome / mentionsAway` checks. */
function tokensOverlap(a: string, b: string): number {
  if (!a || !b) return 0
  const ta = new Set(a.split(' ').filter((t) => t.length >= 3))
  const tb = new Set(b.split(' ').filter((t) => t.length >= 3))
  if (ta.size === 0 || tb.size === 0) return 0
  let hit = 0
  for (const t of ta) if (tb.has(t)) hit++
  return Math.round((hit / Math.min(ta.size, tb.size)) * 100)
}

export function shiftDate(iso: string, days: number): string {
  try {
    const d = new Date(iso)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  } catch {
    return iso
  }
}

/** Fetch a window of unique dates with one /fixtures?date=… call each. */
export async function fetchFixturesForDates(dates: Iterable<string>): Promise<Map<string, any[]>> {
  const map = new Map<string, any[]>()
  await Promise.all(
    Array.from(new Set(dates)).map(async (d) => {
      const fixtures = (await apiFetch(`/fixtures?date=${d}`)) ?? []
      map.set(d, fixtures)
    })
  )
  return map
}
