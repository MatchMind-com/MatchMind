import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/bankroll
 *
 * Returns the user's bankroll state synthesised from THREE sources of truth:
 *
 *   1. starting_bankroll  — from profiles.starting_bankroll
 *   2. bankroll_snapshots — manual user-recorded balances over time
 *   3. bet_slips          — settled bets contribute their profit_loss
 *                           pending bets contribute exposure
 *
 * Computed fields (so the UI can show "£X bankroll · £Y in play · £Z available"):
 *
 *   current_bankroll    = starting + sum(settled bets' profit_loss).
 *                         Falls back to the latest manual snapshot if the
 *                         user has been logging balances directly.
 *   in_play_stake       = sum(stake) over result='pending' bets
 *   in_play_potential   = sum(potential_return) over pending bets
 *                         (so user can see "if everything wins → £Y")
 *   available           = current_bankroll - in_play_stake
 *   settled_pl          = sum of all settled profit_loss
 *
 * `current_bankroll` already reflects auto-settled outcomes because
 * /api/bet-slips/my-live writes them back into bet_slips.result on every
 * poll. So this endpoint is the one number the UI trusts everywhere.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: snapshots }, { data: profile }, { data: betsRows }] = await Promise.all([
    supabase
      .from('bankroll_snapshots')
      .select('balance, recorded_at, note')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('starting_bankroll')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('bet_slips')
      .select('id, result, stake, odds, potential_return, profit_loss')
      .eq('user_id', user.id),
  ])

  const startingFromProfile = Number(profile?.starting_bankroll ?? 0)
  const lastSnapshot = snapshots && snapshots.length > 0
    ? Number(snapshots[snapshots.length - 1].balance)
    : null

  // Aggregate over bet_slips
  let settledPL = 0
  let inPlayStake = 0
  let inPlayPotential = 0
  let pendingCount = 0
  let wonCount = 0
  let lostCount = 0
  for (const b of betsRows ?? []) {
    const stake = Number(b.stake ?? 0) || 0
    const odds = Number(b.odds ?? 0) || 0
    const pr = Number(b.potential_return ?? (stake * odds)) || 0
    const pl = Number(b.profit_loss ?? 0) || 0
    if (b.result === 'pending') {
      inPlayStake += stake
      inPlayPotential += pr
      pendingCount++
    } else if (b.result === 'win') {
      settledPL += pl
      wonCount++
    } else if (b.result === 'loss') {
      settledPL += pl // pl is negative
      lostCount++
    }
    // 'void' contributes 0
  }

  // current_bankroll: prefer (starting + settled P/L). If the user has been
  // manually snapshotting (e.g. "I deposited another £50"), respect the
  // most recent manual snapshot as a baseline override.
  // Strategy: take the LATER of the latest manual snapshot or the computed
  // (starting + settled). This handles both "I just track via bets" users
  // AND "I top up my balance manually" users gracefully.
  const computedFromBets = startingFromProfile + settledPL
  const currentBankroll = lastSnapshot != null
    ? Math.max(lastSnapshot, computedFromBets) // never undershoot computed
    : computedFromBets

  const available = Math.max(0, currentBankroll - inPlayStake)

  // Round all money values to 2dp for display
  const r2 = (n: number) => Math.round(n * 100) / 100

  return NextResponse.json({
    snapshots: snapshots ?? [],
    starting_bankroll: r2(startingFromProfile),
    current_bankroll: r2(currentBankroll),
    in_play_stake: r2(inPlayStake),
    in_play_potential: r2(inPlayPotential),
    available: r2(available),
    settled_pl: r2(settledPL),
    counts: {
      pending: pendingCount,
      won: wonCount,
      lost: lostCount,
    },
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { balance, note } = await req.json()
  await supabase.from('bankroll_snapshots').insert({
    user_id: user.id,
    balance,
    note: note || null,
  })
  return NextResponse.json({ ok: true })
}
