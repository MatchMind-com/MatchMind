import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import TrialBanner from '@/components/dashboard/TrialBanner'
import { getTrialInfo } from '@/lib/trial'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch created_at to compute trial status
  const { data: profile } = await supabase
    .from('profiles')
    .select('created_at, subscription_tier')
    .eq('user_id', user.id)
    .single()

  const trial = getTrialInfo(profile?.created_at)
  const isAlreadyPaid = profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'elite'
  const showBanner = trial.isActive && !isAlreadyPaid

  return (
    <div className="min-h-screen bg-[#0B0B14]">
      <Sidebar email={user.email!} />
      <div className="lg:pl-64 pt-14 lg:pt-0 min-h-screen flex flex-col">
        {showBanner && <TrialBanner daysLeft={trial.daysLeft} />}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
