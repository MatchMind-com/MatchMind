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

  // ── Match-result family ────────────────────────────────────────
  const isHomePick =
    /\bhome\b/.test(sel) ||
    sel.startsWith('1') ||
    (homeName && sel.includes(homeName.toLowerCase()))
  const isAwayPick =
    /\baway\b/.test(sel) ||
    sel.startsWith('2') ||
    (awayName && sel.includes(awayName.toLowerCase()))
  const isDrawPick = /\bdraw\b/.test(sel) || sel === 'x'

  if (bt.includes('match result') || bt.includes('1x2') || /win$|to win/.test(sel)) {
    if (isHomePick) return finished ? settle(home > away) : liveCash(home > away)
    if (isAwayPick) return finished ? settle(away > home) : liveCash(away > home)
    if (isDrawPick) return finished ? settle(home === away) : liveCash(home === away)
  }
  if (bt.includes('double chance')) {
    const homeOrDraw = home >= away
    const drawOrAway = away >= home
    const eitherWin = home !== away
    if (sel.includes('1x') || sel.includes('home/draw') || sel.includes('home or draw')) {
      return finished ? settle(homeOrDraw) : liveCash(homeOrDraw)
    }
    if (sel.includes('x2') || sel.includes('draw/away') || sel.includes('draw or away')) {
      return finished ? settle(drawOrAway) : liveCash(drawOrAway)
    }
    if (sel.includes('12') || sel.includes('home/away') || sel.includes('either')) {
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

  // ── Fallback ───────────────────────────────────────────────────
  if (live) return { state: 'tbd', label: 'In play', context: `${homeName} ${home}-${away} ${awayName}` }
  if (finished) return { state: 'tbd', label: 'Settled — see book', context: `${homeName} ${home}-${away} ${awayName}` }
  return { state: 'pending', label: 'Pending' }
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
