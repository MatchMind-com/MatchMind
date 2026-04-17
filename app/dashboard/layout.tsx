import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import OnboardingProvider from '@/components/onboarding/OnboardingProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <div className="min-h-screen bg-[#0B0B14]">
      <Sidebar email={user.email!} />
      <div className="lg:pl-60 pt-14 lg:pt-0 min-h-screen">
        {children}
      </div>
      {/* Onboarding modal — auto-shows on first login, never again after completion */}
      <OnboardingProvider />
    </div>
  )
}
