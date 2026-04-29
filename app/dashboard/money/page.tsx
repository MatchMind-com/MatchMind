import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import MoneyClient from '@/components/money/MoneyClient'

/**
 * Phase 5 — /dashboard/money.
 *
 * The "financial center" of the app. Merges what used to live across
 * /dashboard/bankroll, /dashboard/dream-bet and /dashboard/track-record
 * into one editorial multi-tab page. The legacy URLs still resolve via
 * their own pages — this is the new front door.
 *
 * Server-fetched bootstrap data:
 *   - profile.starting_bankroll (+ a small auto-recovery shim mirroring
 *     the old bankroll page, for users whose snapshots predate the
 *     starting_bankroll field being persisted reliably).
 *   - latest bankroll snapshot for the current balance.
 *
 * Track-record / goals data is loaded client-side from existing API
 * routes — keeps SSR fast and lets the tabs hydrate independently.
 */
export default async function MoneyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: allSnapshots }] = await Promise.all([
    supabase
      .from('profiles')
      .select('starting_bankroll, loss_limit')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('bankroll_snapshots')
      .select('balance, recorded_at')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: true }),
  ])

  const earliestSnapshot = allSnapshots?.[0]
  const latestSnapshot = allSnapshots?.[allSnapshots.length - 1]

  // Auto-recovery — mirror /dashboard/bankroll/page.tsx so users who started
  // before the starting_bankroll RLS fix don't get bounced into the setup
  // form. If the profile's starting bankroll is 0 but historic snapshots
  // exist, adopt the earliest snapshot as the starting bankroll and persist
  // it via service role.
  let startingBankroll = Number(profile?.starting_bankroll ?? 0)
  if (startingBankroll === 0 && earliestSnapshot?.balance) {
    startingBankroll = Number(earliestSnapshot.balance)
    try {
      const admin = createAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await admin
        .from('profiles')
        .update({ starting_bankroll: startingBankroll })
        .eq('user_id', user.id)
    } catch (e) {
      console.error('[money] auto-recovery backfill failed:', (e as Error).message)
    }
  }

  const currentBankroll =
    latestSnapshot?.balance != null ? Number(latestSnapshot.balance) : startingBankroll

  return (
    <MoneyClient
      userId={user.id}
      initialBankroll={currentBankroll}
      startingBankroll={startingBankroll}
      lossLimit={profile?.loss_limit ?? null}
    />
  )
}
