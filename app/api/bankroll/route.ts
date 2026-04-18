import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: snapshots }, { data: profile }] = await Promise.all([
    supabase.from('bankroll_snapshots').select('*').eq('user_id', user.id).order('recorded_at', { ascending: true }),
    supabase.from('profiles').select('starting_bankroll').eq('user_id', user.id).single(),
  ])
  const starting = Number(profile?.starting_bankroll ?? 0)
  const last = snapshots && snapshots.length > 0 ? Number(snapshots[snapshots.length - 1].balance) : starting
  return NextResponse.json({
    snapshots: snapshots ?? [],
    starting_bankroll: starting,
    current_bankroll: last,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { balance, note } = await req.json()
  await supabase.from('bankroll_snapshots').insert({ user_id: user.id, balance, note: note || null })
  return NextResponse.json({ ok: true })
}
