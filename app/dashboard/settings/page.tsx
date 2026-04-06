import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from '@/components/dashboard/SettingsClient'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('daily_alert_opt_in, weekly_report_opt_in, loss_limit, take_a_break_until, subscription_tier')
    .eq('id', user.id)
    .single()

  return (
    <SettingsClient
      userId={user.id}
      initialSettings={{
        daily_alert_opt_in: profile?.daily_alert_opt_in ?? false,
        weekly_report_opt_in: profile?.weekly_report_opt_in ?? true,
        loss_limit: profile?.loss_limit ?? null,
        take_a_break_until: profile?.take_a_break_until ?? null,
        subscription_tier: profile?.subscription_tier ?? 'free',
      }}
    />
  )
}
