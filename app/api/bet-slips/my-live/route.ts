/**
 * GET /api/bet-slips/my-live
 *
 * Returns the signed-in user's currently active bets — singles AND
 * accumulators — enriched with live fixture data + per-pick assessment.
 *
 * Powers the "My Live Bets" section on the home page. Polled every 60s
 * from the client; we cap the work to bets dated within ±2 days of today
 * so a user with hundreds of historical pending bets doesn't blow the
 * API-Football quota on each refresh.
 *
 * Response shape:
 *   {
 *     bets: [
 *       {
 *         ...bet_slip row (id, match_name, bet_type, selection, odds, stake, …),
 *         is_acca: boolean,
 *         live: PickEvaluation,                  // for singles
 *         legs?: Array<AccaLeg & { live: PickEvaluation }>,  // for accas
 *         counts?: { won, cashing, losing, pending, lost, total }
 *       }
 *     ],
 *     summary: { total, in_play_now, today_upcoming, cashing, behind },
 *     computed_at: ISO timestamp
 *   }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  AccaLeg,
  evaluatePick,
  fetchFixturesForDates,
  IN_PLAY_STATUSES,
  matchFixture,
  parseAccaLegs,
  PickEvaluation,
  shiftDate,
} from '@/lib/live-bet-evaluator'

export const revalidate = 30

interface BetRow {
  id: string
  user_id: string
  match_name: string | null
  league: string | null
  bet_type: string | null
  selection: string | null
  odds: number | null
  stake: number | null
  potential_return: number | null
  result: 'pending' | 'win' | 'loss' | 'void'
  match_date: string | null
  notes: string | null
  bookmaker: string | null
  created_at: string | null
}

interface LiveSingle {
  matched: boolean
  fixture_id?: number | null
  status?: string
  status_long?: string
  minute?: number | null
  home_team?: string
  away_team?: string
  home_score?: number | null
  away_score?: number | null
  state: PickEvaluation['state']
  label: string
  context?: string
}

interface LiveLeg extends AccaLeg {
  live: LiveSingle
}

interface EnrichedBet extends BetRow {
  is_acca: boolean
  /** Single-bet live data (null for accas). */
  live: LiveSingle | null
  /** Acca legs (only present for accas). */
  legs?: LiveLeg[]
  counts?: {
    total: number
    won: number
    lost: number
    cashing: number
    losing: number
    pending: number
  }
  /** Convenience: are any leg/single in_play right now? */
  has_live: boolean
}

const TODAY_WINDOW_DAYS = 2 // include yesterday/today/tomorrow

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
function isoDaysFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Within the ±N-day window around today? Treats null as "include" so legacy bets surface. */
function isInActiveWindow(date: string | null | undefined): boolean {
  if (!date) return true
  const fromMs = new Date(isoDaysFromToday(-TODAY_WINDOW_DAYS)).getTime()
  const toMs = new Date(isoDaysFromToday(TODAY_WINDOW_DAYS)).getTime() + 86_400_000
  const t = new Date(date).getTime()
  return Number.isFinite(t) && t >= fromMs && t <= toMs
}

function makeFallbackLive(state: PickEvaluation['state'] = 'pending', label = 'Awaiting'): LiveSingle {
  return { matched: false, state, label }
}

function liveFromFixture(fx: any, evaluation: PickEvaluation): LiveSingle {
  return {
    matched: true,
    fixture_id: fx?.fixture?.id ?? null,
    status: fx?.fixture?.status?.short ?? 'NS',
    status_long: fx?.fixture?.status?.long ?? 'Not started',
    minute: fx?.fixture?.status?.elapsed ?? null,
    home_team: fx?.teams?.home?.name,
    away_team: fx?.teams?.away?.name,
    home_score: fx?.goals?.home ?? null,
    away_score: fx?.goals?.away ?? null,
    state: evaluation.state,
    label: evaluation.label,
    context: evaluation.context,
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: betsRaw, error } = await supabase
      .from('bet_slips')
      .select('id, user_id, match_name, league, bet_type, selection, odds, stake, potential_return, result, match_date, notes, bookmaker, created_at')
      .eq('user_id', user.id)
      .eq('result', 'pending')
      .order('match_date', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('[my-live] supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const allPending: BetRow[] = (betsRaw ?? []) as BetRow[]

    // Restrict to a window so we don't query API-Football for 100+ stale bets.
    const candidates: BetRow[] = []
    for (const b of allPending) {
      const legs = parseAccaLegs(b.notes)
      if (legs && legs.length) {
        const anyInWindow = legs.some((l) => isInActiveWindow(l.match_date))
        if (anyInWindow) candidates.push(b)
        continue
      }
      if (isInActiveWindow(b.match_date)) candidates.push(b)
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        bets: [],
        summary: { total: 0, in_play_now: 0, today_upcoming: 0, cashing: 0, behind: 0 },
        computed_at: new Date().toISOString(),
      })
    }

    // Collect every unique date we need to fetch fixtures for.
    const dates = new Set<string>()
    for (const b of candidates) {
      const legs = parseAccaLegs(b.notes)
      if (legs && legs.length) {
        for (const l of legs) {
          if (l.match_date && isInActiveWindow(l.match_date)) dates.add(l.match_date)
        }
      } else if (b.match_date && isInActiveWindow(b.match_date)) {
        dates.add(b.match_date.slice(0, 10))
      }
    }
    if (dates.size === 0) dates.add(todayISO())
    // Always include today as a safety net for legs with stale/null dates.
    dates.add(todayISO())

    const fixturesByDate = await fetchFixturesForDates(dates)

    // Enrich each bet
    const enriched: EnrichedBet[] = candidates.map((b) => {
      const legsSaved = parseAccaLegs(b.notes)
      const isAcca = !!(legsSaved && legsSaved.length > 1)

      if (isAcca && legsSaved) {
        const enrichedLegs: LiveLeg[] = legsSaved.map((leg) => {
          const date = leg.match_date ?? todayISO()
          const fxPool = [
            ...(fixturesByDate.get(date) ?? []),
            ...(fixturesByDate.get(shiftDate(date, -1)) ?? []),
            ...(fixturesByDate.get(shiftDate(date, 1)) ?? []),
          ]
          const fx = matchFixture(fxPool, leg.match_name)
          if (!fx) return { ...leg, live: makeFallbackLive('pending', 'Awaiting') }
          const evaluation = evaluatePick(leg.selection, leg.bet_type, fx)
          return { ...leg, live: liveFromFixture(fx, evaluation) }
        })
        const counts = {
          total: enrichedLegs.length,
          won: enrichedLegs.filter((l) => l.live.state === 'won').length,
          lost: enrichedLegs.filter((l) => l.live.state === 'lost').length,
          cashing: enrichedLegs.filter((l) => l.live.state === 'cashing').length,
          losing: enrichedLegs.filter((l) => l.live.state === 'losing').length,
          pending: enrichedLegs.filter((l) => l.live.state === 'pending').length,
        }
        const has_live = enrichedLegs.some((l) => (IN_PLAY_STATUSES as readonly string[]).includes(l.live.status ?? ''))
        return { ...b, is_acca: true, live: null, legs: enrichedLegs, counts, has_live }
      }

      // Single bet
      const date = b.match_date?.slice(0, 10) ?? todayISO()
      const fxPool = [
        ...(fixturesByDate.get(date) ?? []),
        ...(fixturesByDate.get(shiftDate(date, -1)) ?? []),
        ...(fixturesByDate.get(shiftDate(date, 1)) ?? []),
      ]
      const fx = b.match_name ? matchFixture(fxPool, b.match_name) : null
      if (!fx) {
        return {
          ...b,
          is_acca: false,
          live: makeFallbackLive('pending', 'Awaiting'),
          has_live: false,
        }
      }
      const evaluation = evaluatePick(b.selection ?? '', b.bet_type, fx)
      const live = liveFromFixture(fx, evaluation)
      return {
        ...b,
        is_acca: false,
        live,
        has_live: (IN_PLAY_STATUSES as readonly string[]).includes(live.status ?? ''),
      }
    })

    // Sort: in-play first, then today, then upcoming, then unmatched
    enriched.sort((a, b) => {
      const liveDiff = Number(b.has_live) - Number(a.has_live)
      if (liveDiff !== 0) return liveDiff
      const aDate = a.match_date ?? '9999-12-31'
      const bDate = b.match_date ?? '9999-12-31'
      return aDate.localeCompare(bDate)
    })

    const summary = {
      total: enriched.length,
      in_play_now: enriched.filter((b) => b.has_live).length,
      today_upcoming: enriched.filter((b) => {
        const d = b.match_date?.slice(0, 10)
        return !b.has_live && d === todayISO()
      }).length,
      cashing: enriched.reduce((s, b) => {
        if (b.is_acca && b.counts) return s + b.counts.cashing
        if (!b.is_acca && b.live?.state === 'cashing') return s + 1
        return s
      }, 0),
      behind: enriched.reduce((s, b) => {
        if (b.is_acca && b.counts) return s + b.counts.losing
        if (!b.is_acca && b.live?.state === 'losing') return s + 1
        return s
      }, 0),
    }

    return NextResponse.json({
      bets: enriched,
      summary,
      computed_at: new Date().toISOString(),
    })
  } catch (e: any) {
    console.error('[my-live] unexpected:', e?.message, e?.stack)
    return NextResponse.json({ error: 'Failed to load live bets' }, { status: 500 })
  }
}
