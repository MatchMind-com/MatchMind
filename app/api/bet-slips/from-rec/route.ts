/**
 * POST /api/bet-slips/from-rec
 *
 * Inserts a bet_slips row from an AI-recommended bet (the [BET_REC] payload
 * surfaced by the AI Coach or Live Co-Pilot). Powers the "Add to my bets"
 * button in those chat UIs.
 *
 * Body: { home, away, market, selection, odds, stake, league, kickoff,
 *         reasoning, fixtureId? }
 *
 * Schema reference (see /components/dashboard/BetSlipForm.tsx for the canonical
 * insert shape):
 *   - match_name, league, bet_type, selection
 *   - odds, stake, potential_return
 *   - result: 'pending', profit_loss: 0
 *   - match_date (DATE, nullable), notes
 *   - fixture_id (nullable)
 *
 * The `bet_slips` table doesn't have a dedicated `source` column — we tag
 * AI-recommended bets in the `notes` field instead, which keeps existing
 * triggers/RLS untouched.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Body = {
  home?: string | null
  away?: string | null
  market?: string | null
  selection?: string | null
  odds?: number | string | null
  stake?: number | string | null
  league?: string | null
  kickoff?: string | null
  reasoning?: string | null
  fixtureId?: number | string | null
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toStr(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed ? trimmed : null
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const home = toStr(body.home)
  const away = toStr(body.away)
  const market = toStr(body.market) ?? 'Match Result (1X2)'
  const selection = toStr(body.selection) ?? 'See details'
  const odds = toNum(body.odds)
  const stake = toNum(body.stake)
  const league = toStr(body.league)
  const kickoff = toStr(body.kickoff)
  const reasoning = toStr(body.reasoning)
  const fixtureId = toNum(body.fixtureId)

  // Required fields — degrade gracefully so a partially malformed bet rec
  // still produces a sane row rather than a 400.
  if (!odds || odds <= 1) {
    return NextResponse.json({ error: 'odds must be > 1' }, { status: 400 })
  }
  if (!stake || stake <= 0) {
    return NextResponse.json({ error: 'stake must be > 0' }, { status: 400 })
  }

  // match_name combines the two team names. If we only have one side
  // (rare — the parser would have rejected the rec), fall back to selection.
  const matchName =
    home && away ? `${home} vs ${away}` :
    home || away || selection || 'AI Recommended Bet'

  // Convert kickoff (full ISO timestamp) to a DATE for match_date.
  let matchDate: string | null = null
  if (kickoff) {
    const d = new Date(kickoff)
    if (!Number.isNaN(d.getTime())) {
      matchDate = d.toISOString().split('T')[0]
    }
  }

  const noteParts: string[] = ['Added from AI recommendation']
  if (reasoning) noteParts.push(reasoning)
  const notes = noteParts.join(' — ')

  const potentialReturn = Math.round(odds * stake * 100) / 100

  try {
    const { data, error } = await supabase
      .from('bet_slips')
      .insert({
        user_id: user.id,
        match_name: matchName,
        league: league,
        bet_type: market,
        selection: selection,
        odds: odds,
        stake: stake,
        potential_return: potentialReturn,
        result: 'pending',
        profit_loss: 0,
        match_date: matchDate,
        notes: notes,
        fixture_id: fixtureId ?? null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[bet-slips/from-rec] insert failed:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to insert bet slip' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, id: data?.id ?? null })
  } catch (e: any) {
    console.error('[bet-slips/from-rec] exception:', e)
    return NextResponse.json(
      { error: e?.message || 'Unexpected error' },
      { status: 500 }
    )
  }
}
