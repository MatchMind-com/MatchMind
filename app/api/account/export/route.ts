import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profile, betSlips, bankrollSnapshots, userPreferences, aiSessions] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('bet_slips').select('*').eq('user_id', user.id),
    supabase.from('bankroll_snapshots').select('*').eq('user_id', user.id),
    supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('ai_sessions').select('*').eq('user_id', user.id),
  ])

  const bundle = {
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profile.data,
    bet_slips: betSlips.data ?? [],
    bankroll_snapshots: bankrollSnapshots.data ?? [],
    user_preferences: userPreferences.data,
    ai_sessions: aiSessions.data ?? [],
  }

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="matchmind-export-${user.id}-${Date.now()}.json"`,
    },
  })
}
