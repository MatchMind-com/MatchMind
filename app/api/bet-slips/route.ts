/**
 * /api/bet-slips
 *
 * GET  → list the signed-in user's bet_slips (auth-gated, RLS-scoped).
 *        Most-recent first. The History tab uses this to render and edit
 *        personal bets — distinct from /api/track-record, which queries
 *        the system-wide `prediction_records` table.
 *
 * POST → insert a manually-entered bet (the "+ Add manual bet" modal on
 *        the History tab). Auth-gated, RLS-scoped. The OCR endpoint at
 *        /api/upload-bet is image-only and unchanged.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Result = 'win' | 'loss' | 'void' | 'pending'

interface ManualBetBody {
  match_name?: string | null
  league?: string | null
  bet_type?: string | null
  selection?: string | null
  odds?: number | string | null
  stake?: number | string | null
  bookmaker?: string | null
  match_date?: string | null
  notes?: string | null
  result?: Result | null
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function isResult(v: unknown): v is Result {
  return v === 'win' || v === 'loss' || v === 'void' || v === 'pending'
}

function computePL(result: Result, odds: number, stake: number): number {
  if (result === 'win') return Math.round((odds - 1) * stake * 100) / 100
  if (result === 'loss') return -Math.round(stake * 100) / 100
  return 0
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('bet_slips')
    .select(
      'id, user_id, match_name, league, bet_type, selection, odds, stake, bookmaker, potential_return, result, profit_loss, match_date, notes, fixture_id, created_at'
    )
    .eq('user_id', user.id)
    .order('match_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ bets: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: ManualBetBody
  try {
    body = (await req.json()) as ManualBetBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const matchName = (body.match_name ?? '').toString().trim()
  const betType = (body.bet_type ?? '').toString().trim() || 'Match Result (1X2)'
  const selection = (body.selection ?? '').toString().trim()
  const odds = toNum(body.odds)
  const stake = toNum(body.stake)
  const result: Result = isResult(body.result) ? body.result : 'pending'

  if (!matchName) return NextResponse.json({ error: 'match_name is required' }, { status: 400 })
  if (!selection) return NextResponse.json({ error: 'selection is required' }, { status: 400 })
  if (!odds || odds <= 1) return NextResponse.json({ error: 'odds must be > 1' }, { status: 400 })
  if (!stake || stake <= 0) return NextResponse.json({ error: 'stake must be > 0' }, { status: 400 })

  const profitLoss = computePL(result, odds, stake)
  const potentialReturn = Math.round(odds * stake * 100) / 100

  const insertRow = {
    user_id: user.id,
    match_name: matchName,
    league: body.league ? body.league.toString().trim() || null : null,
    bet_type: betType,
    selection,
    odds,
    stake,
    bookmaker: body.bookmaker ? body.bookmaker.toString().trim() || null : null,
    potential_return: potentialReturn,
    result,
    profit_loss: profitLoss,
    match_date: body.match_date ? body.match_date.toString().slice(0, 10) : null,
    notes: body.notes ? body.notes.toString().trim() || null : null,
  }

  const { data, error } = await supabase
    .from('bet_slips')
    .insert(insertRow)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, id: data?.id ?? null })
}
