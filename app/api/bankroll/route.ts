import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('bankroll_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('recorded_at', { ascending: true })
  return NextResponse.json({ snapshots: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { balance, note } = await req.json()
  await supabase.from('bankroll_snapshots').insert({ user_id: user.id, balance, note: note || null })
  await supabase.from('profiles').update({ current_bankroll: balance }).eq('id', user.id)
  return NextResponse.json({ ok: true })
}
