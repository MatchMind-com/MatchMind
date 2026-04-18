import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Delete all user-owned rows, then the auth user. Order matters for FKs.
  const tables = ['bet_slips', 'bankroll_snapshots', 'ai_sessions', 'user_preferences', 'onboarding_emails', 'profiles']
  for (const t of tables) {
    const { error } = await admin.from(t).delete().eq('user_id', user.id)
    if (error) console.error(`[account/delete] ${t}:`, error.message)
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(user.id)
  if (authErr) {
    console.error('[account/delete] auth.deleteUser:', authErr.message)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }

  // Sign the session out client-side by returning a signal
  return NextResponse.json({ ok: true })
}
