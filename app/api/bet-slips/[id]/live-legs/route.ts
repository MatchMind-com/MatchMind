/**
 * GET /api/bet-slips/[id]/live-legs
 *
 * For accumulator bet slips, returns each leg enriched with:
 *   - Live fixture status (NS / 1H / HT / 2H / FT / etc.) + minute
 *   - Current home/away score
 *   - Per-leg evaluation: is the user's pick currently winning, losing,
 *     already cashing, or already lost?
 *   - Overall acca summary: wins / losses / pending
 *
 * Auth-gated, RLS-scoped to the signed-in user.
 *
 * Strategy: groups legs by match_date, makes ONE /fixtures?date=… call per
 * unique date (cheap on the API-Football side, results cached by Next), then
 * matches each leg's `match_name` to a fixture by team-name fuzzy compare.
 *
 * No DB writes — purely a read endpoint that the History tab polls every
 * 60 seconds while there's an in-play leg.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 30 // Allow Next to cache identical requests for 30s

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

// ── Types ────────────────────────────────────────────────────────────

interface AccaLeg {
  match_name: string
  selection: string
  odds: number
  league?: string | null
  match_date?: string | null
  bet_type?: string | null
  result?: 'win' | 'loss' | 'void' | 'pending'
}

type LegState = 'pending' | 'cashing' | 'losing' | 'won' | 'lost' | 'tbd' | 'void'

interface LiveLeg extends AccaLeg {
  live: {
    matched: boolean
    fixture_id?: number | null
    status?: string // short status (NS, 1H, HT, 2H, FT, …)
    status_long?: string
    minute?: number | null
    home_team?: string
    away_team?: string
    home_score?: number | null
    away_score?: number | null
    venue?: string | null
    /** State of the user's pick right now. */
    state: LegState
    /** Short human-readable label, e.g. "Cashing", "Behind", "Won" */
    label: string
    /** Optional context one-liner, e.g. "Liverpool 2-0 — needs to hold for win" */
    context?: string
  }
}

// ── API-Football fetch ───────────────────────────────────────────────

async function apiFetch(path: string): Promise<any[] | null> {
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

// ── Notes parsing ────────────────────────────────────────────────────

function parseAccaLegs(notes: string | null | undefined): AccaLeg[] | null {
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

// ── Team-name fuzzy match ────────────────────────────────────────────
//
// API-Football team names don't always match what bookmakers print on a
// shop slip. We normalise both sides (lowercase, drop "FC" / "AC" / "CF"
// suffixes, drop diacritics) then check substring overlap.

function normTeam(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/\b(fc|cf|ac|sc|sk|fk|cd|de|club|f\.c\.)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function teamMatches(slipName: string, fxName: string): number {
  const a = normTeam(slipName)
  const b = normTeam(fxName)
  if (!a || !b) return 0
  if (a === b) return 100
  if (a.includes(b) || b.includes(a)) return 80
  // Token overlap
  const ta = new Set(a.split(' '))
  const tb = new Set(b.split(' '))
  let overlap = 0
  for (const t of ta) if (tb.has(t)) overlap++
  if (overlap === 0) return 0
  // 2/3 token overlap counts as a match
  return Math.round((overlap / Math.max(ta.size, tb.size)) * 70)
}

function matchFixture(fixtures: any[], matchName: string): any | null {
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
    // Try home/home + away/away first, then swapped (handles flipped order).
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

// ── Pick evaluator ───────────────────────────────────────────────────
//
// Given a user's selection text (e.g. "Home Win", "Over 2.5", "BTTS Yes",
// "Liverpool to win") and the current fixture state, return whether the
// pick is currently in a winning, losing, definitively-won, or
// definitively-lost state.

const FINISHED = ['FT', 'AET', 'PEN', 'AWD', 'WO']
const IN_PLAY = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE']
const NOT_STARTED = ['NS', 'TBD']

function evaluatePick(
  selection: string,
  betType: string | null | undefined,
  fx: any
): { state: LegState; label: string; context?: string } {
  const status = fx?.fixture?.status?.short ?? 'NS'
  const home = Number(fx?.goals?.home ?? 0) || 0
  const away = Number(fx?.goals?.away ?? 0) || 0
  const homeName = fx?.teams?.home?.name ?? 'Home'
  const awayName = fx?.teams?.away?.name ?? 'Away'
  const finished = FINISHED.includes(status)
  const live = IN_PLAY.includes(status)
  const notStarted = NOT_STARTED.includes(status) || status === 'PST' || status === 'CANC'

  if (notStarted) {
    return { state: 'pending', label: 'Not started' }
  }

  const sel = selection.toLowerCase()
  const bt = (betType ?? '').toLowerCase()

  const liveCash = (winning: boolean) =>
    winning
      ? { state: 'cashing' as LegState, label: 'Cashing', context: `${homeName} ${home}-${away} ${awayName}` }
      : { state: 'losing' as LegState, label: 'Behind', context: `${homeName} ${home}-${away} ${awayName}` }
  const settle = (winning: boolean) =>
    winning
      ? { state: 'won' as LegState, label: 'Won', context: `${homeName} ${home}-${away} ${awayName}` }
      : { state: 'lost' as LegState, label: 'Lost', context: `${homeName} ${home}-${away} ${awayName}` }

  // ── Match-result family ──────────────────────────────────────────
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

  // ── Over/Under family ────────────────────────────────────────────
  const ouMatch = sel.match(/(over|under)\s*([\d.]+)/i)
  if (ouMatch) {
    const side = ouMatch[1].toLowerCase()
    const line = parseFloat(ouMatch[2])
    const totalGoals = home + away
    if (side === 'over') {
      // Already over the line → already won, regardless of remaining time.
      if (totalGoals > line) {
        return { state: finished ? 'won' : 'won', label: finished ? 'Won' : 'Already cashed', context: `${totalGoals} goals already` }
      }
      // Finished at-or-below line → lost.
      if (finished) return settle(false)
      // In play but not yet over.
      return { state: 'losing', label: 'Behind', context: `${totalGoals} of ${line + 0.5} goals` }
    } else {
      // Under: any goal past the line → already lost.
      if (totalGoals > line) {
        return { state: finished ? 'lost' : 'lost', label: finished ? 'Lost' : 'Already lost', context: `${totalGoals} goals scored` }
      }
      if (finished) return settle(true)
      return { state: 'cashing', label: 'Cashing', context: `${totalGoals} of max ${line - 0.5} goals` }
    }
  }

  // ── BTTS family ──────────────────────────────────────────────────
  if (sel.includes('btts') || bt.includes('both teams') || sel.includes('both teams')) {
    const yes = sel.includes('yes') || (!sel.includes('no') && bt.includes('yes'))
    const both = home > 0 && away > 0
    if (yes) {
      if (both) return { state: finished ? 'won' : 'won', label: finished ? 'Won' : 'Already cashed', context: 'Both scored' }
      if (finished) return settle(false)
      return { state: 'losing', label: 'Behind', context: `${homeName} ${home}-${away} ${awayName}` }
    } else {
      if (both) return { state: finished ? 'lost' : 'lost', label: finished ? 'Lost' : 'Already lost', context: 'Both teams scored' }
      if (finished) return settle(true)
      return { state: 'cashing', label: 'Holding', context: `${homeName} ${home}-${away} ${awayName}` }
    }
  }

  // ── Fallback ─────────────────────────────────────────────────────
  if (live) {
    return { state: 'tbd', label: 'In play', context: `${homeName} ${home}-${away} ${awayName}` }
  }
  if (finished) {
    return { state: 'tbd', label: 'Settled — see book', context: `${homeName} ${home}-${away} ${awayName}` }
  }
  return { state: 'pending', label: 'Pending' }
}

// ── Route handler ────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: bet, error } = await supabase
      .from('bet_slips')
      .select('id, user_id, notes, bet_type, match_date, result')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error || !bet) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 })
    }

    const legs = parseAccaLegs(bet.notes)
    if (!legs) {
      // Not an acca → return empty payload, not an error
      return NextResponse.json({
        legs: [],
        is_acca: false,
        computed_at: new Date().toISOString(),
      })
    }

    // Group leg dates so we make one /fixtures?date=… call per unique day.
    // Some legs may have null dates — for those, fall back to today + a
    // 7-day window around the slip's overall match_date.
    const dateSet = new Set<string>()
    for (const l of legs) if (l.match_date) dateSet.add(l.match_date)
    if (dateSet.size === 0 && bet.match_date) dateSet.add(bet.match_date.slice(0, 10))
    if (dateSet.size === 0) dateSet.add(new Date().toISOString().slice(0, 10))

    const fixturesByDate = new Map<string, any[]>()
    await Promise.all(
      Array.from(dateSet).map(async (d) => {
        const fixtures = (await apiFetch(`/fixtures?date=${d}`)) ?? []
        fixturesByDate.set(d, fixtures)
      })
    )

    // Match each leg to a fixture and evaluate
    const enriched: LiveLeg[] = legs.map((leg) => {
      const date = leg.match_date ?? Array.from(dateSet)[0]
      const fixtures = fixturesByDate.get(date) ?? []
      // Also try sibling dates ±1 (slip dates can be off by a day for late kickoffs)
      const widerFixtures = [
        ...fixtures,
        ...(fixturesByDate.get(shiftDate(date, -1)) ?? []),
        ...(fixturesByDate.get(shiftDate(date, 1)) ?? []),
      ]
      const fx = matchFixture(widerFixtures, leg.match_name)

      if (!fx) {
        return {
          ...leg,
          live: {
            matched: false,
            state: leg.result === 'win' ? 'won' : leg.result === 'loss' ? 'lost' : 'pending',
            label: leg.result === 'win' ? 'Won' : leg.result === 'loss' ? 'Lost' : 'Awaiting',
            context: 'Fixture not found in live feed',
          },
        }
      }

      const evaluation = evaluatePick(leg.selection, leg.bet_type, fx)

      return {
        ...leg,
        live: {
          matched: true,
          fixture_id: fx?.fixture?.id ?? null,
          status: fx?.fixture?.status?.short ?? 'NS',
          status_long: fx?.fixture?.status?.long ?? 'Not started',
          minute: fx?.fixture?.status?.elapsed ?? null,
          home_team: fx?.teams?.home?.name,
          away_team: fx?.teams?.away?.name,
          home_score: fx?.goals?.home ?? null,
          away_score: fx?.goals?.away ?? null,
          venue: fx?.fixture?.venue?.name ?? null,
          state: evaluation.state,
          label: evaluation.label,
          context: evaluation.context,
        },
      }
    })

    // Overall acca summary
    const counts = {
      total: enriched.length,
      won: enriched.filter((l) => l.live.state === 'won').length,
      lost: enriched.filter((l) => l.live.state === 'lost').length,
      cashing: enriched.filter((l) => l.live.state === 'cashing').length,
      losing: enriched.filter((l) => l.live.state === 'losing').length,
      pending: enriched.filter((l) => l.live.state === 'pending').length,
      tbd: enriched.filter((l) => l.live.state === 'tbd').length,
      in_play: enriched.filter((l) => IN_PLAY.includes(l.live.status ?? '')).length,
    }
    const overall: 'lost' | 'cashing' | 'on_track' | 'pending' | 'won' =
      counts.lost > 0
        ? 'lost'
        : counts.won === counts.total
          ? 'won'
          : counts.losing > 0 || counts.tbd > 0
            ? 'cashing'
            : counts.cashing > 0
              ? 'on_track'
              : 'pending'

    return NextResponse.json({
      legs: enriched,
      is_acca: true,
      counts,
      overall,
      has_in_play: counts.in_play > 0,
      computed_at: new Date().toISOString(),
    })
  } catch (e: any) {
    console.error('[live-legs] error:', e?.message, e?.stack)
    return NextResponse.json(
      { error: 'Failed to load live leg status' },
      { status: 500 }
    )
  }
}

function shiftDate(iso: string, days: number): string {
  try {
    const d = new Date(iso)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  } catch {
    return iso
  }
}
