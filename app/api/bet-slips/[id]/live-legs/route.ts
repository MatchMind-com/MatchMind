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
import {
  AccaLeg,
  evaluatePick,
  fetchFixturesForDates,
  IN_PLAY_STATUSES,
  LegState,
  matchFixture,
  parseAccaLegs,
  shiftDate,
} from '@/lib/live-bet-evaluator'

export const revalidate = 30

interface LiveLeg extends AccaLeg {
  live: {
    matched: boolean
    fixture_id?: number | null
    status?: string
    status_long?: string
    minute?: number | null
    home_team?: string
    away_team?: string
    home_score?: number | null
    away_score?: number | null
    venue?: string | null
    state: LegState
    label: string
    context?: string
  }
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

    const fixturesByDate = await fetchFixturesForDates(dateSet)

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
      in_play: enriched.filter((l) => (IN_PLAY_STATUSES as readonly string[]).includes(l.live.status ?? '')).length,
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
