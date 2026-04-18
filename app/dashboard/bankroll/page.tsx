import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BankrollTracker from '@/components/bankroll/BankrollTracker'

export default async function BankrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: latestSnapshot }] = await Promise.all([
    supabase
      .from('profiles')
      .select('starting_bankroll')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('bankroll_snapshots')
      .select('balance')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const startingBankroll = profile?.starting_bankroll ?? 0
  const currentBankroll = latestSnapshot?.balance ?? startingBankroll

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
      />
    </div>
  )
}
