import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BillingPage from '@/components/billing/BillingPage'

export default async function Billing() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_status, subscription_current_period_end, stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  return <BillingPage profile={profile} />
}
