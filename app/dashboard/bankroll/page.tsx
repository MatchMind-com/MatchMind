import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import BankrollTracker from '@/components/bankroll/BankrollTracker'

export default async function BankrollPage() {
  const supabase = await createClient()
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

  // Auto-recovery: if the profile's starting_bankroll is 0 but the user
  // has snapshots (previous sessions where the RLS bug silently dropped
  // the update), adopt the earliest snapshot's balance as the starting
  // bankroll and persist it via service role so we don't keep showing
  // the setup form.
  let startingBankroll = profile?.starting_bankroll ?? 0
  if (startingBankroll === 0 && earliestSnapshot?.balance) {
    startingBankroll = Number(earliestSnapshot.balance)
    try {
      const admin = createAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await admin.from('profiles').update({ starting_bankroll: startingBankroll }).eq('user_id', user.id)
    } catch (e) {
      console.error('[bankroll] auto-recovery backfill failed:', (e as Error).message)
    }
  }

  const currentBankroll = latestSnapshot?.balance != null ? Number(latestSnapshot.balance) : startingBankroll

  return (
    <div className="p-5 lg:p-7 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-slate-500 text-xs uppercase tracking-widest mb-1 font-medium">Finance</p>
        <h1 className="text-3xl font-black text-white tracking-tight mb-1">Bankroll</h1>
        <p className="text-slate-500 text-sm">Track your balance over time and monitor your growth.</p>
      </div>
      <BankrollTracker
        userId={user.id}
        initialBankroll={currentBankroll}
        startingBankroll={startingBankroll}
        lossLimit={profile?.loss_limit ?? null}
      />
    </div>
  )
}
