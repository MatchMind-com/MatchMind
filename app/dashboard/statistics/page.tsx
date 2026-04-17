import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function StatisticsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-2">
        <p className="text-slate-500 text-xs uppercase tracking-widest mb-1 font-medium">Analytics</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Statistics</h1>
        <p className="text-slate-500 text-sm mt-1">Your full betting history and performance analytics</p>
      </div>
      <DashboardClient userId={user!.id} email={user!.email!} />
    </div>
  )
}
