import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsPage from '@/components/settings/SettingsPage'

export default async function Settings() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('daily_alert_opt_in, weekly_report_opt_in, loss_limit, take_a_break_until, subscription_tier')
    .eq('user_id', user.id)
    .single()

  return <SettingsPage profile={profile} email={user.email!} />
}
