import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

/**
 * PUT /api/bankroll/starting  { amount: number }
 *
 * Sets the user's starting_bankroll. Routed through the server + service-role
 * client because Supabase RLS blocks client-side profile updates, which
 * caused BankrollTracker to silently fail and prompt users to re-enter their
 * starting value on every refresh.
 */
export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error: updateErr } = await admin
    .from('profiles')
    .update({ starting_bankroll: amount })
    .eq('user_id', user.id)

  if (updateErr) {
    console.error('[bankroll/starting] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // Insert first snapshot so the chart has a data point from day one
  const { data: existing } = await admin
    .from('bankroll_snapshots')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  if (!existing || existing.length === 0) {
    await admin.from('bankroll_snapshots').insert({
      user_id: user.id,
      balance: amount,
      note: 'Starting bankroll',
    })
  }

  return NextResponse.json({ ok: true, starting_bankroll: amount })
}
