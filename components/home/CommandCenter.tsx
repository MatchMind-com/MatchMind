'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BetSlipForm from '@/components/dashboard/BetSlipForm'
import WeeklyReportCard from '@/components/home/WeeklyReportCard'
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

function OnboardingChecklist({ bets }: { bets: BetSlip[] }) {
  const hasBet = bets.length > 0
  const hasSettled = bets.some(b => b.result === 'win' || b.result === 'loss')
  const hasAnalysis = hasSettled && bets.length >= 2

  const steps = [
    {
      num: 1,
      label: 'Add your first bet',
      desc: 'Log a match you\'re thinking about placing',
      done: hasBet,
      icon: '📝',
    },
    {
      num: 2,
      label: 'Mark it won or lost',
      desc: 'After the match, update the result',
      done: hasSettled,
      icon: '✅',
    },
    {
      num: 3,
      label: 'Get your AI analysis',
      desc: 'See your win rate, ROI, and AI coaching',
      done: hasAnalysis,
      icon: '🤖',
    },
  ]

  const completed = steps.filter(s => s.done).length

  if (completed === steps.length) return null

  return (
    <div className="bg-gradient-to-br from-violet-600/10 to-indigo-600/5 border border-violet-500/20 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white font-semibold text-sm">🚀 Get started in 3 steps</p>
          <p className="text-white/40 text-xs mt-0.5">Your dashboard unlocks as you go</p>
        </div>
        <div className="text-right">
          <p className="text-violet-300 font-black text-lg">{completed}/3</p>
          <p className="text-white/30 text-xs">complete</p>
        </div>
      </div>
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/5 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700"
          style={{ width: `${(completed / steps.length) * 100}%` }}
        />
      </div>
      <div className="space-y-2.5">
        {steps.map(step => (
          <div
            key={step.num}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
              step.done
                ? 'bg-emerald-500/8 border border-emerald-500/15'
                : 'bg-white/[0.03] border border-white/8'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 font-bold transition-all ${
              step.done
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-white/5 text-white/30'
            }`}>
              {step.done ? '✓' : step.num}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${step.done ? 'text-emerald-300 line-through decoration-emerald-500/30' : 'text-white'}`}>{step.label}</p>
              <p className="text-white/30 text-xs mt-0.5">{step.desc}</p>
            </div>
            <span className="text-lg shrink-0">{step.icon}</span>
          </div>
        ))}
      </div>
    </div>
  )
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

  // Streak
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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {getGreeting()}, {firstName} 👋
          </h1>
          <p className="text-white/40 text-sm mt-0.5">Here's your betting command center</p>
        </div>
        {hasPastPending && (
          <button
            onClick={autoCheckResults}
            disabled={checkingResults}
            className="flex items-center gap-2 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/25 text-emerald-300 text-sm font-medium px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
          >
            {checkingResults
              ? <><span className="animate-spin inline-block">⟳</span> Checking results...</>
              : <><span>🔍</span> Auto-check results</>
            }
          </button>
        )}
      </div>

      {/* Onboarding checklist — shown until all 3 steps are done */}
      <OnboardingChecklist bets={bets} />

      {/* Auto-check feedback */}
      {checkFeedback && (
        <div className={`rounded-xl p-4 border text-sm ${checkFeedback.updated.length > 0 ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-white/4 border-white/10'}`}>
          {checkFeedback.updated.length > 0 ? (
            <div>
              <p className="text-emerald-400 font-semibold mb-2">
                ✅ {checkFeedback.updated.length} bet{checkFeedback.updated.length > 1 ? 's' : ''} automatically resolved!
              </p>
              {checkFeedback.updated.map((u, i) => (
                <div key={i} className="text-white/50 text-xs mb-1">
                  • <span className="text-white/70">{u.match_name}</span> →{' '}
                  <span className={u.result === 'win' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {u.result.toUpperCase()}
                  </span>
                  {u.match_result && <span className="text-white/30"> ({u.match_result})</span>}
                  {u.confidence && <span className="text-white/25"> · {u.confidence} confidence</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/40">
              No results found yet — matches may still be upcoming or AI couldn't find the scores. Try again after match day.
            </p>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#12121F] border border-white/10 rounded-2xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Streak</p>
          <p className="text-2xl font-bold text-white">
            {streak > 0 ? `${streakType === 'win' ? '🔥' : '❄️'} ${streak}` : '—'}
          </p>
          <p className="text-white/25 text-xs mt-1">
            {streak > 0 ? `${streak} ${streakType}${streak > 1 ? 's' : ''} in a row` : 'No data yet'}
          </p>
        </div>
        <div className="bg-[#12121F] border border-white/10 rounded-2xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Win Rate</p>
          <p className="text-2xl font-bold text-white">{winRate}%</p>
          <p className="text-white/25 text-xs mt-1">{won.length}W · {settled.length - won.length}L</p>
        </div>
        <div className={`bg-[#12121F] border rounded-2xl p-5 ${totalPnL >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Total P&L</p>
          <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnL >= 0 ? '+' : ''}£{totalPnL.toFixed(2)}
          </p>
          <p className="text-white/25 text-xs mt-1">all time</p>
        </div>
        <div className="bg-[#12121F] border border-amber-500/20 rounded-2xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Pending</p>
          <p className="text-2xl font-bold text-amber-400">{pending.length}</p>
          <p className="text-white/25 text-xs mt-1">awaiting results</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left — pending bets + add form */}
        <div className="xl:col-span-2 space-y-5">
          {pending.length > 0 && (
            <div className="bg-[#12121F] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Pending Bets</h3>
                <span className="text-white/30 text-xs">{pending.length} open</span>
              </div>
              <div className="divide-y divide-white/5">
                {pending.slice(0, 6).map(bet => (
                  <div key={bet.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{bet.match_name}</p>
                      <p className="text-white/40 text-xs mt-0.5">
                        {bet.selection} · {bet.bet_type} · £{bet.stake} @ {bet.odds}
                      </p>
                      {bet.match_date && (
                        <p className="text-white/25 text-xs mt-0.5">
                          {new Date(bet.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => markBet(bet.id, 'win')}
                        className="text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-colors font-medium"
                      >
                        +£{(bet.stake * (bet.odds - 1)).toFixed(0)} ✓
                      </button>
                      <button
                        onClick={() => markBet(bet.id, 'loss')}
                        className="text-xs bg-red-500/15 hover:bg-red-500/25 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 transition-colors font-medium"
                      >
                        -£{bet.stake} ✗
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <BetSlipForm userId={userId} onBetAdded={refreshBets} />
        </div>

        {/* Right — weekly report + quick nav */}
        <div className="space-y-4">
          <WeeklyReportCard />
          <div className="bg-[#12121F] border border-white/10 rounded-2xl p-4">
            <h3 className="text-white/60 text-xs uppercase tracking-wider font-semibold mb-3">Quick Navigation</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/dashboard/statistics', icon: '📈', label: 'Statistics' },
                { href: '/dashboard/bankroll', icon: '💰', label: 'Bankroll' },
                { href: '/dashboard/suggestions', icon: '🤖', label: 'AI Tips' },
                { href: '/dashboard/coach', icon: '⚽', label: 'Coach' },
              ].map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 bg-white/4 hover:bg-white/8 border border-white/8 rounded-xl p-3 text-white/50 hover:text-white text-xs font-medium transition-all"
                >
                  <span className="text-base">{item.icon}</span>
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
