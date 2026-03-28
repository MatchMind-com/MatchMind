'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BetSlip } from '@/lib/types'
import StatsOverview from './StatsOverview'
import BetSlipForm from './BetSlipForm'
import BetHistory from './BetHistory'
import PerformanceChart from './PerformanceChart'
import AICoaching from './AICoaching'

export default function DashboardClient({ userId, email }: { userId: string; email: string }) {
  const supabase = createClient()
  const [bets, setBets] = useState<BetSlip[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBets = useCallback(async () => {
    const { data } = await supabase.from('bet_slips').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    setBets(data || []); setLoading(false)
  }, [userId, supabase])

  useEffect(() => { fetchBets() }, [fetchBets])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-slate-500 text-sm">Loading your dashboard...</span>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <StatsOverview bets={bets}/>
      <PerformanceChart bets={bets}/>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BetSlipForm userId={userId} onBetAdded={fetchBets}/>
        <AICoaching userId={userId} bets={bets}/>
      </div>
      <BetHistory bets={bets} onUpdate={fetchBets}/>
    </div>
  )
}
