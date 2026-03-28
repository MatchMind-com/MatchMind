import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CoachPageWithData from '@/components/coach/CoachPageWithData'

export default async function FootballCoachPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, full_name')
    .eq('id', user.id)
    .single()

  return <CoachPageWithData user={user} profile={profile} />
}
