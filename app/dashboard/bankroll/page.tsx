import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BankrollTracker from '@/components/bankroll/BankrollTracker'

export default async function BankrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_bankroll, starting_bankroll')
    .eq('id', user.id)
    .single()

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">💰 Bankroll Tracker</h1>
        <p className="text-white/40 text-sm">Track your balance over time and monitor your growth.</p>
      </div>
      <BankrollTracker
        userId={user.id}
        initialBankroll={profile?.current_bankroll ?? 0}
        startingBankroll={profile?.starting_bankroll ?? 0}
      />
    </div>
  )
}
