import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

/**
 * POST /api/bankroll/reset
 *
 * Wipes all bankroll snapshots for the current user AND resets
 * profiles.starting_bankroll to 0, effectively returning them to the
 * setup-flow state. Destructive — requires an authed session.
 *
 * Service role is used for the writes because the RLS policy blocks
 * client-side profile updates (same reason the original setup bug
 * existed).
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error: snapshotsErr } = await admin
    .from('bankroll_snapshots')
    .delete()
    .eq('user_id', user.id)

  const { error: profileErr } = await admin
    .from('profiles')
    .update({ starting_bankroll: 0 })
    .eq('user_id', user.id)

  if (snapshotsErr || profileErr) {
    console.error('[bankroll/reset] failed:', snapshotsErr?.message, profileErr?.message)
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
