'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BetSlipForm from '@/components/dashboard/BetSlipForm'
import WeeklyReportCard from '@/components/home/WeeklyReportCard'
import TodaysGames from '@/components/matches/TodaysGames'
import { BetSlip } from '@/lib/types'

interface Props {
  userId: string
  email: string
  initialBets: BetSlip[]
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

interface CheckResultItem {
  id: string
  result: string
  match_name: string
  match_result: string
  confidence: string
}

export default function CommandCenter({ userId, email, initialBets }: Props) {
  const supabase = createClient()
  const [bets, setBets] = useState<BetSlip[]>(initialBets)
  const [checkingResults, setCheckingResults] = useState(false)
  const [checkFeedback, setCheckFeedback] = useState<{ checked: number; updated: CheckResultItem[] } | null>(null)

  const firstName = email.split('@')[0]
  const pending = bets.filter(b => b.result === 'pending')
  const settled = bets.filter(b => b.result === 'win' || b.result === 'loss')
  const won = settled.filter(b => b.result === 'win')
  const totalPnL = bets.reduce((s, b) => s + (Number(b.profit_loss) || 0), 0)
  const winRate = settled.length > 0 ? Math.round((won.length / settled.length) * 100) : 0

  const recentSettled = [...bets]
    .filter(b => b.result === 'win' || b.result === 'loss')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  let streak = 0
  const streakType = recentSettled[0]?.result
  for (const b of recentSettled) {
    if (b.result === streakType) streak++
    else break
  }

  const hasPastPending = pending.some(b => b.match_date && new Date(b.match_date) < new Date())

  async function refreshBets() {
    const { data } = await supabase
      .from('bet_slips')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setBets(data)
  }

  async function markBet(id: string, result: 'win' | 'loss' | 'void') {
    const bet = bets.find(b => b.id === id)
    if (!bet) return
    const profitLoss =
      result === 'win' ? bet.stake * (bet.odds - 1)
      : result === 'loss' ? -bet.stake
      : 0
    await supabase.from('bet_slips').update({ result, profit_loss: profitLoss }).eq('id', id)
    refreshBets()
  }

  async function autoCheckResults() {
    setCheckingResults(true)
    setCheckFeedback(null)
    try {
      const res = await fetch('/api/check-results', { method: 'POST' })
      const data = await res.json()
      setCheckFeedback(data)
      if (data.updated?.length > 0) refreshBets()
    } catch {
      setCheckFeedback({ checked: 0, updated: [] })
    }
    setCheckingResults(false)
  }

  return (
    <div className="p-5 lg:p-7 max-w-7xl mx-auto space-y-7">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-widest mb-1 font-medium">{getGreeting()}</p>
          <h1 className="text-3xl font-black text-white tracking-tight">{firstName}</h1>
        </div>
        {hasPastPending && (
          <button
            onClick={autoCheckResults}
            disabled={checkingResults}
            className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-blue-300 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
          >
            {checkingResults ? (
              <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full" /> Checking...</>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Auto-check results
              </>
            )}
          </button>
        )}
      </div>

      {/* Auto-check feedback */}
      {checkFeedback && (
        <div className={`rounded-xl p-4 border text-sm ${checkFeedback.updated.length > 0 ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-white/3 border-white/8'}`}>
          {checkFeedback.updated.length > 0 ? (
            <div>
              <p className="text-emerald-400 font-bold mb-2">{checkFeedback.updated.length} bet{checkFeedback.updated.length > 1 ? 's' : ''} automatically resolved</p>
              {checkFeedback.updated.map((u, i) => (
                <div key={i} className="text-slate-400 text-xs mb-1">
                  <span className="text-slate-200">{u.match_name}</span>{' → '}
                  <span className={u.result === 'win' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {u.result.toUpperCase()}
                  </span>
                  {u.match_result && <span className="text-slate-600"> ({u.match_result})</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">No results found yet — try again after match day.</p>
          )}
        </div>
      )}

      {/* Stat cards — scoreboard style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Streak */}
        <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Streak</p>
          <p className="text-4xl font-black text-white leading-none mb-1">
            {streak > 0 ? streak : '—'}
          </p>
          <p className="text-xs text-slate-500">
            {streak > 0 ? `${streak} ${streakType}${streak > 1 ? 's' : ''} in a row` : 'No data yet'}
          </p>
          {streak >= 3 && streakType === 'win' && (
            <div className="absolute top-3 right-3 text-amber-400 text-xs font-bold">HOT</div>
          )}
        </div>

        {/* Win Rate */}
        <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Win Rate</p>
          <p className="text-4xl font-black text-white leading-none mb-1">{winRate}<span className="text-2xl text-slate-400">%</span></p>
          <p className="text-xs text-slate-500">{won.length}W · {settled.length - won.length}L</p>
        </div>

        {/* P&L */}
        <div className={`bg-[#0E1628] rounded-2xl p-5 relative overflow-hidden border
          ${totalPnL > 0 ? 'border-emerald-500/20' : totalPnL < 0 ? 'border-red-500/20' : 'border-white/[0.07]'}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Total P&L</p>
          <p className={`text-4xl font-black leading-none mb-1 ${totalPnL > 0 ? 'text-emerald-400' : totalPnL < 0 ? 'text-red-400' : 'text-white'}`}>
            {totalPnL >= 0 ? '+' : ''}£{Math.abs(totalPnL).toFixed(2)}
          </p>
          <p className="text-xs text-slate-500">all time</p>
        </div>

        {/* Pending */}
        <div className={`bg-[#0E1628] rounded-2xl p-5 relative overflow-hidden border
          ${pending.length > 0 ? 'border-amber-500/20' : 'border-white/[0.07]'}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Pending</p>
          <p className={`text-4xl font-black leading-none mb-1 ${pending.length > 0 ? 'text-amber-400' : 'text-white'}`}>
            {pending.length}
          </p>
          <p className="text-xs text-slate-500">awaiting results</p>
        </div>
      </div>

      {/* Today's Games */}
      <TodaysGames />

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left — pending bets + add form */}
        <div className="xl:col-span-2 space-y-5">
          {pending.length > 0 && (
            <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
                <h3 className="text-white font-bold text-sm tracking-tight">Pending Bets</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold">{pending.length} open</span>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {pending.slice(0, 6).map(bet => (
                  <div key={bet.id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{bet.match_name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {bet.selection} · {bet.bet_type} · £{bet.stake} @ {bet.odds}
                      </p>
                      {bet.match_date && (
                        <p className="text-slate-600 text-xs mt-0.5">
                          {new Date(bet.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => markBet(bet.id, 'win')}
                        className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-colors font-bold"
                      >
                        +£{(bet.stake * (bet.odds - 1)).toFixed(0)}
                      </button>
                      <button
                        onClick={() => markBet(bet.id, 'loss')}
                        className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 transition-colors font-bold"
                      >
                        -£{bet.stake}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <BetSlipForm userId={userId} onBetAdded={refreshBets} />
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <WeeklyReportCard />

          {/* Quick nav */}
          <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-4">
            <h3 className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Quick Access</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/dashboard/predictions', label: 'AI Picks', icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                )},
                { href: '/dashboard/statistics', label: 'Statistics', icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                )},
                { href: '/dashboard/bankroll', label: 'Bankroll', icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )},
                { href: '/dashboard/coach', label: 'AI Coach', icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                )},
              ].map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] hover:border-blue-500/20 rounded-xl p-3 text-slate-400 hover:text-white text-xs font-semibold transition-all group"
                >
                  <span className="text-slate-500 group-hover:text-blue-400 transition-colors">{item.icon}</span>
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
