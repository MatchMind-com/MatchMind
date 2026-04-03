import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// PATCH /api/tipsters/tips/[tipId] — update tip result (win/loss/void)
export async function PATCH(req: NextRequest, { params }: { params: { tipId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { result } = await req.json()
  if (!['win', 'loss', 'void'].includes(result)) {
    return NextResponse.json({ error: 'Result must be win, loss, or void' }, { status: 400 })
  }

  // Get the tip and verify ownership
  const { data: tip } = await supabaseAdmin
    .from('tips').select('*, tipsters!inner(user_id)').eq('id', params.tipId).single()
  if (!tip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((tip.tipsters as any).user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Calculate profit/loss in units
  let profit_loss = 0
  if (result === 'win') profit_loss = parseFloat(((tip.odds - 1) * tip.stake_units).toFixed(2))
  else if (result === 'loss') profit_loss = -tip.stake_units
  else profit_loss = 0 // void — no change

  const { data, error } = await supabaseAdmin
    .from('tips')
    .update({ result, profit_loss })
    .eq('id', params.tipId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tip: data })
}
