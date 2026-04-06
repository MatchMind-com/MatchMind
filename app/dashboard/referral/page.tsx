import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReferralClient from '@/components/dashboard/ReferralClient'

export default async function ReferralPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get or create referral code from profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('referral_code, referral_count, subscription_tier')
    .eq('id', user.id)
    .single()

  // Count how many users signed up with this code
  const referralCode = profile?.referral_code || user.id.slice(0, 8).toUpperCase()

  return (
    <ReferralClient
      referralCode={referralCode}
      referralCount={profile?.referral_count ?? 0}
      subscriptionTier={profile?.subscription_tier ?? 'free'}
    />
  )
}
