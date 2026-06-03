'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BetSlip } from '@/lib/types'
import StatsOverview from './StatsOverview'
import BetSlipForm from './BetSlipForm'
import BetHistory from './BetHistory'
import PerformanceChart from './PerformanceChart'
import AICoaching from './AICoaching'
import InsightsBanner from '@/components/conversion/InsightsBanner'

const FORCE_PRO_TIER = true // temp: set false to restore paywall
import ExitIntentPopup from '@/components/conversion/ExitIntentPopup'
import UpgradeModal from '@/components/conversion/UpgradeModal'

const FREE_BET_LIMIT = 10

export default function DashboardClient({ userId, email }: { userId: string; email: string }) {
  const supabase = createClient()
  const [bets, setBets] = useState<BetSlip[]>([])
  const [loading, setLoading] = useState(true)
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'elite'>('free')
  const [showPaywall, setShowPaywall] = useState(false)

  const fetchBets = useCallback(async () => {
    const { data } = await supabase
      .from('bet_slips')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setBets(data || [])
    setLoading(false)
  }, [userId, supabase])

  const fetchProfile = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single()
    if (data?.subscription_tier) {
      setSubscriptionTier(data.subscription_tier)
    }
  }, [userId, supabase])

  useEffect(() => {
    fetchBets()
    fetchProfile()
  }, [fetchBets, fetchProfile])

  // Check if free user has hit the paywall on returning visits
  useEffect(() => {
    if (!loading && subscriptionTier === 'free' && bets.length >= FREE_BET_LIMIT) {
      // Don't auto-show on load — only when they try to add a bet
      // But do show a subtle indicator on the form
    }
  }, [loading, subscriptionTier, bets.length])

  // Called by BetSlipForm before submitting — intercept if free user at limit
  const handleBetAttempt = useCallback((): boolean => {
    if (!FORCE_PRO_TIER && subscriptionTier === 'free' && bets.length >= FREE_BET_LIMIT) {
      setShowPaywall(true)
      return false // block the submission
    }
    return true // allow the submission
  }, [subscriptionTier, bets.length])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent animate-spin"></div>
          <span className="text-[#6B6860] text-sm">Loading your dashboard...</span>
        </div>
      </div>
    )
  }

  const isAtPaywall = !FORCE_PRO_TIER && subscriptionTier === 'free' && bets.length >= FREE_BET_LIMIT

  return (
    <>
      {/* Exit-Intent Popup — mounts once, handles its own trigger logic */}
      <ExitIntentPopup subscriptionTier={subscriptionTier} />

      {/* Paywall modal — triggered when free user tries to add 11th bet */}
      <UpgradeModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        betCount={bets.length}
        trigger="paywall"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Insights Banner — shows for free users with 3+ bets */}
        <InsightsBanner bets={bets} subscriptionTier={subscriptionTier} />

        {/* Paywall notice bar — shows when at the limit */}
        {isAtPaywall && (
          <div
            className="flex items-center justify-between px-5 py-4 border cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(249,115,22,0.08) 100%)',
              borderColor: 'rgba(239,68,68,0.25)',
            }}
            onClick={() => setShowPaywall(true)}
          >
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0"><rect x="3" y="11" width="18" height="11"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <div>
                <p className="text-sm font-semibold text-white">
                  Free limit reached — {bets.length}/{FREE_BET_LIMIT} bets used
                </p>
                <p className="text-xs text-slate-500">Upgrade to Pro to log unlimited bets and unlock all AI insights</p>
              </div>
            </div>
            <button className="bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold px-4 py-2 flex-shrink-0 transition-colors">
              Upgrade Now →
            </button>
          </div>
        )}

        {/* Stats */}
        <StatsOverview bets={bets} />

        {/* Charts */}
        <PerformanceChart bets={bets} />

        {/* Main Grid: Form + AI Coach */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BetSlipForm
            userId={userId}
            onBetAdded={fetchBets}
            onBetAttempt={handleBetAttempt}
            isAtPaywall={isAtPaywall}
            onShowPaywall={() => setShowPaywall(true)}
          />
          <AICoaching userId={userId} bets={bets} />
        </div>

        {/* Bet History */}
        <BetHistory bets={bets} onUpdate={fetchBets} />
      </div>
    </>
  )
}
