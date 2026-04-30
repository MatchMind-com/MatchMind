/**
 * /api/bet-slips/[id]
 *
 * PATCH  → update fields on a single bet_slips row.
 *          Body: { result?, odds?, stake?, profit_loss?, notes?, bookmaker?, match_date?, match_name?, league?, bet_type?, selection? }
 *          When `result` changes (and an explicit `profit_loss` is not
 *          supplied) we recompute P/L from result + odds + stake using the
 *          same formula as the cron grader: win = (odds-1)*stake,
 *          loss = -stake, void/pending = 0.
 *
 * DELETE → hard-delete the row.
 *
 * Both verbs are auth-gated and RLS-scoped (the anon-key client we get from
 * createClient() respects bet_slips.user_id = auth.uid()).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Result = 'win' | 'loss' | 'void' | 'pending'

interface PatchBody {
  result?: Result | null
  odds?: number | string | null
  stake?: number | string | null
  profit_loss?: number | string | null
  notes?: string | null
  bookmaker?: string | null
  match_date?: string | null
  match_name?: string | null
  league?: string | null
  bet_type?: string | null
  selection?: string | null
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Look up the existing row so we can recompute P/L when result changes
  // without trusting client-supplied odds/stake unless they were also passed.
  const { data: existing, error: fetchErr } = await supabase
    .from('bet_slips')
    .select('id, odds, stake, result, profit_loss')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'Bet not found' }, { status: 404 })
  }

  // ── Build the patch ──────────────────────────────────────────────
  const patch: Record<string, unknown> = {}

  if ('result' in body) {
    if (body.result == null || isResult(body.result)) {
      patch.result = body.result ?? 'pending'
    } else {
      return NextResponse.json({ error: 'Invalid result value' }, { status: 400 })
    }
  }

  let oddsAfter = Number(existing.odds) || 0
  if ('odds' in body) {
    const n = toNum(body.odds)
    if (n == null || n <= 1) {
      return NextResponse.json({ error: 'odds must be > 1' }, { status: 400 })
    }
    patch.odds = n
    oddsAfter = n
  }

  let stakeAfter = Number(existing.stake) || 0
  if ('stake' in body) {
    const n = toNum(body.stake)
    if (n == null || n <= 0) {
      return NextResponse.json({ error: 'stake must be > 0' }, { status: 400 })
    }
    patch.stake = n
    stakeAfter = n
  }

  // potential_return tracks odds * stake whenever either changes
  if ('odds' in patch || 'stake' in patch) {
    patch.potential_return = Math.round(oddsAfter * stakeAfter * 100) / 100
  }

  // P/L: explicit value wins; otherwise recompute when result/odds/stake moved
  if ('profit_loss' in body && body.profit_loss != null) {
    const n = toNum(body.profit_loss)
    if (n == null) {
      return NextResponse.json({ error: 'Invalid profit_loss' }, { status: 400 })
    }
    patch.profit_loss = n
  } else if ('result' in patch || 'odds' in patch || 'stake' in patch) {
    const resultAfter = (patch.result as Result | undefined) ?? (existing.result as Result) ?? 'pending'
    patch.profit_loss = computePL(resultAfter, oddsAfter, stakeAfter)
  }

  // String fields — pass through if explicitly present
  if ('notes' in body) patch.notes = body.notes ?? null
  if ('bookmaker' in body) patch.bookmaker = body.bookmaker ?? null
  if ('match_date' in body) patch.match_date = body.match_date ?? null
  if ('match_name' in body && body.match_name) patch.match_name = body.match_name
  if ('league' in body) patch.league = body.league ?? null
  if ('bet_type' in body && body.bet_type) patch.bet_type = body.bet_type
  if ('selection' in body && body.selection) patch.selection = body.selection

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bet_slips')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, bet: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('bet_slips')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
