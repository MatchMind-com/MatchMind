'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import {
  kellyStake, computeStats, monthlyPnL, simulateVariance,
  type SimParams, type Snapshot as LibSnapshot,
} from '@/lib/bankroll'

interface Snapshot {
  id: string
  balance: number
  note: string | null
  recorded_at: string
}

interface Props {
  userId: string
  initialBankroll: number
  startingBankroll: number
  lossLimit?: number | null
}

export default function BankrollTracker({ userId, initialBankroll, startingBankroll, lossLimit }: Props) {
  const supabase = createClient()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [currentBalance, setCurrentBalance] = useState(initialBankroll)
  const [starting, setStarting] = useState(startingBankroll)
  const [newBalance, setNewBalance] = useState('')
  const [note, setNote] = useState('')
  const [startInput, setStartInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [settingUp, setSettingUp] = useState(startingBankroll === 0)

  // Kelly calculator state
  const [kEdge, setKEdge] = useState('10')
  const [kOdds, setKOdds] = useState('2.00')
  const [kFraction, setKFraction] = useState<0.25 | 0.5 | 1>(0.5)

  // Unit sizing (localStorage so it sticks across sessions)
  const [unitPct, setUnitPct] = useState<number>(2)
  useEffect(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('mm_unit_pct') : null
    if (v) setUnitPct(Number(v) || 2)
  }, [])
  function saveUnitPct(v: number) {
    const clamped = Math.max(0.5, Math.min(10, v))
    setUnitPct(clamped)
    if (typeof window !== 'undefined') localStorage.setItem('mm_unit_pct', String(clamped))
  }

  // Variance simulator state
  const [showSim, setShowSim] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function resetBankroll() {
    const confirmText = window.prompt(
      'This will permanently delete all your bankroll snapshots and reset your starting bankroll.\n\nType RESET to confirm.'
    )
    if (confirmText !== 'RESET') return
    setResetting(true)
    const res = await fetch('/api/bankroll/reset', { method: 'POST' })
    if (!res.ok) {
      alert('Reset failed. Please try again.')
      setResetting(false)
      return
    }
    // Hard reload so the server component re-reads the now-zeroed starting_bankroll
    // and sends us back into the setup flow.
    window.location.reload()
  }
  const [simParams, setSimParams] = useState<SimParams>({
    bankroll: currentBalance,
    avgEdgePct: 8,
    avgOdds: 2.0,
    stakePct: 2,
    betsPerWeek: 10,
    weeks: 26,
  })

  useEffect(() => { loadSnapshots() }, [])
  useEffect(() => {
    setSimParams(p => ({ ...p, bankroll: currentBalance, stakePct: unitPct }))
  }, [currentBalance, unitPct])

  async function loadSnapshots() {
    const { data } = await supabase
      .from('bankroll_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: true })
    if (data) setSnapshots(data)
  }

  async function setupBankroll() {
    const amount = parseFloat(startInput)
    if (isNaN(amount) || amount <= 0) return
    setLoading(true)
    const res = await fetch('/api/bankroll/starting', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    })
    if (!res.ok) {
      setLoading(false)
      alert('Could not save starting bankroll. Please try again.')
      return
    }
    setStarting(amount)
    setCurrentBalance(amount)
    setSettingUp(false)
    setLoading(false)
    loadSnapshots()
  }

  async function recordBalance() {
    const amount = parseFloat(newBalance)
    if (isNaN(amount) || amount < 0) return
    setLoading(true)
    await supabase.from('bankroll_snapshots').insert({
      user_id: userId, balance: amount, note: note || null
    })
    setCurrentBalance(amount)
    setNewBalance('')
    setNote('')
    setLoading(false)
    loadSnapshots()
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(
    () => computeStats(snapshots as LibSnapshot[], starting),
    [snapshots, starting]
  )
  const months = useMemo(() => monthlyPnL(snapshots as LibSnapshot[]), [snapshots])
  const kellyResult = useMemo(() => {
    const ev = parseFloat(kEdge), odds = parseFloat(kOdds)
    if (isNaN(ev) || isNaN(odds)) return 0
    return kellyStake(currentBalance, ev, odds, kFraction)
  }, [kEdge, kOdds, kFraction, currentBalance])
  const unitSize = Math.round(currentBalance * (unitPct / 100) * 100) / 100

  // Loss-limit warning
  const lossLimitTriggered = lossLimit != null && lossLimit > 0 && currentBalance <= lossLimit
  const lossLimitNear = lossLimit != null && lossLimit > 0 && !lossLimitTriggered && currentBalance <= lossLimit * 1.15

  const pnl = stats.current - stats.startingBalance
  const chartData = snapshots.map(s => ({
    date: new Date(s.recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    balance: Number(s.balance),
    note: s.note,
  }))

  // ── Setup flow ─────────────────────────────────────────────────────────────
  if (settingUp) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-[#0E1628] border border-white/[0.07] p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Set Your Starting Bankroll</h2>
          <p className="text-slate-500 mb-6 text-sm">
            Enter the amount you&apos;re starting with to track growth, size stakes with Kelly, and simulate variance.
          </p>
          <input
            type="number"
            value={startInput}
            onChange={e => setStartInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setupBankroll()}
            placeholder="e.g. 500"
            className="w-full bg-white/[0.04] border border-white/[0.07] px-4 py-3 text-white text-xl text-center mb-4 focus:outline-none focus:border-orange-500/50 focus:bg-white/[0.06] transition-colors"
          />
          <button
            onClick={setupBankroll}
            disabled={loading || !startInput}
            className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 transition-colors disabled:opacity-50"
          >
            {loading ? 'Setting up…' : 'Start Tracking →'}
          </button>
        </div>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[#0E1628] border border-white/[0.12] p-3 shadow-xl">
        <p className="text-slate-400 text-xs mb-1">{label}</p>
        <p className="text-white font-bold">£{Number(payload[0].value).toFixed(2)}</p>
        {payload[0].payload?.note && (
          <p className="text-orange-400 text-xs mt-1">{payload[0].payload.note}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* LOSS LIMIT WARNING */}
      {lossLimitTriggered && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 flex items-center gap-3">
          <span className="text-red-400 text-xl">⚠</span>
          <div>
            <p className="text-red-300 font-bold text-sm">Loss limit reached — consider pausing</p>
            <p className="text-red-400/70 text-xs">Your bankroll (£{currentBalance.toFixed(2)}) is at or below your configured limit (£{lossLimit}). Time to step away.</p>
          </div>
        </div>
      )}
      {lossLimitNear && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 flex items-center gap-3">
          <span className="text-amber-400 text-xl">⚠</span>
          <div>
            <p className="text-amber-300 font-bold text-sm">Approaching your loss limit</p>
            <p className="text-amber-400/70 text-xs">£{(currentBalance - lossLimit!).toFixed(2)} above your limit of £{lossLimit}. Bet responsibly.</p>
          </div>
        </div>
      )}

      {/* TOP STATS — 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#0E1628] border border-white/[0.07] p-5">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Current Balance</p>
          <p className="text-3xl md:text-4xl font-black text-white leading-none">£{stats.current.toFixed(2)}</p>
        </div>
        <div className="bg-[#0E1628] border border-white/[0.07] p-5">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Starting</p>
          <p className="text-3xl md:text-4xl font-black text-slate-400 leading-none">£{stats.startingBalance.toFixed(2)}</p>
        </div>
        <div className={`bg-[#0E1628] p-5 border ${pnl >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Growth</p>
          <p className={`text-3xl md:text-4xl font-black leading-none ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}£{Math.abs(pnl).toFixed(2)}
          </p>
          <p className={`text-xs mt-1.5 ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {pnl >= 0 ? '▲' : '▼'} {Math.abs(stats.growthPct)}% all time
          </p>
        </div>
        <div className="bg-[#0E1628] border border-white/[0.07] p-5">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Peak · Drawdown</p>
          <p className="text-2xl md:text-3xl font-black text-orange-400 leading-none">£{stats.peak.toFixed(2)}</p>
          <p className={`text-xs mt-1.5 ${stats.currentDrawdownPct < -5 ? 'text-red-400' : 'text-slate-500'}`}>
            {stats.currentDrawdownPct === 0 ? 'at peak' : `${stats.currentDrawdownPct}% from peak`}
          </p>
        </div>
      </div>

      {/* HOW THIS WORKS — collapsible explainer */}
      <div className="bg-[#0E1628] border border-white/[0.07] overflow-hidden">
        <button onClick={() => setShowHelp(!showHelp)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-orange-400">💡</span>
            <div className="text-left">
              <p className="text-white font-bold text-sm">How this works</p>
              <p className="text-slate-500 text-xs">Bankroll tracking, Kelly stakes, unit sizing, and auto-sync explained</p>
            </div>
          </div>
          <span className={`text-orange-400 transition-transform ${showHelp ? 'rotate-45' : ''}`}>+</span>
        </button>
        {showHelp && (
          <div className="px-5 py-5 border-t border-white/[0.06] space-y-5 text-sm">
            {/* Bankroll tracking */}
            <div>
              <p className="text-white font-bold mb-1">📊 Bankroll tracking</p>
              <p className="text-slate-400 leading-relaxed text-xs">
                Your <span className="text-white">starting bankroll</span> is what you began with. Every time a tracked bet settles, we add a <span className="text-white">snapshot</span> of your new balance. The chart above plots these over time. You can also manually record a snapshot anytime (e.g. after a deposit or withdrawal).
              </p>
            </div>

            {/* Kelly */}
            <div>
              <p className="text-white font-bold mb-1">🎯 Kelly stake calculator</p>
              <p className="text-slate-400 leading-relaxed text-xs mb-2">
                The <span className="text-white">Kelly Criterion</span> is the mathematically optimal fraction of your bankroll to stake on a bet with a known edge. Formula:
              </p>
              <p className="text-orange-300 font-mono text-[11px] bg-white/[0.03] px-3 py-2 border border-white/[0.06]">
                stake = bankroll × ((odds − 1) × true_prob − (1 − true_prob)) / (odds − 1)
              </p>
              <p className="text-slate-400 leading-relaxed text-xs mt-2">
                Full Kelly is mathematically perfect but emotionally brutal — a few bad runs in a row can halve your bankroll. <span className="text-white">Half-Kelly</span> (default) cuts variance dramatically while keeping most of the long-term growth. Pros almost always use fractional Kelly. We also hard-cap at 10% of bankroll on any single bet, no matter what the formula says.
              </p>
            </div>

            {/* Unit sizing */}
            <div>
              <p className="text-white font-bold mb-1">🧮 Unit sizing</p>
              <p className="text-slate-400 leading-relaxed text-xs">
                If you don&apos;t want to think about Kelly every bet, set a fixed <span className="text-white">unit size</span> (e.g. 2% of bankroll) and stake 1 unit per pick. Safer and simpler than Kelly if you&apos;re not confident in the EV numbers. Most sharp bettors stake <span className="text-white">1-3%</span> per bet.
              </p>
            </div>

            {/* Suggested stake on predictions */}
            <div>
              <p className="text-white font-bold mb-1">🔥 Suggested stake on AI Predictions</p>
              <p className="text-slate-400 leading-relaxed text-xs">
                On the <a href="/dashboard/predictions" className="text-orange-400 underline">Predictions</a> page, every value bet now shows a <span className="text-white">Suggested stake</span> sized using half-Kelly against your current bankroll + the pick&apos;s EV + odds. If you haven&apos;t set a bankroll, it falls back to your unit size. This is the number you should actually stake — not a round £10.
              </p>
            </div>

            {/* Auto-sync */}
            <div>
              <p className="text-white font-bold mb-1">🔄 Auto-sync from settled bets</p>
              <p className="text-slate-400 leading-relaxed text-xs">
                When a bet you&apos;ve tracked in the <a href="/dashboard" className="text-orange-400 underline">bet tracker</a> settles (win or loss), the settlement cron (9pm UTC daily) adds a new snapshot to your bankroll chart automatically. No manual work.
              </p>
            </div>

            {/* Variance */}
            <div>
              <p className="text-white font-bold mb-1">🎲 Variance simulator</p>
              <p className="text-slate-400 leading-relaxed text-xs">
                Runs 1,000 simulated &quot;seasons&quot; using your chosen inputs to show the realistic range of outcomes. <span className="text-white">Bust probability</span> tells you how often you go broke; <span className="text-white">double probability</span> tells you how often your bankroll doubles. If bust &gt; 15%, your stakes are too aggressive for the edge you&apos;re claiming.
              </p>
            </div>

            <p className="text-slate-600 text-[11px] italic pt-1">
              Betting involves risk. These tools help you make informed decisions but don&apos;t guarantee profit. Positive EV wins over hundreds of bets, not any single one.
            </p>
          </div>
        )}
      </div>

      {/* UNIT SIZING + KELLY CALCULATOR — 2-col on desktop */}
      <div className="grid md:grid-cols-2 gap-3">
        {/* Unit sizing */}
        <div className="bg-[#0E1628] border border-white/[0.07] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-sm">Unit sizing</h3>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Browser-saved</span>
          </div>
          <p className="text-slate-500 text-xs mb-4">Set your standard stake as a % of bankroll. Used across the app.</p>
          <div className="flex items-center gap-3">
            <input
              type="number" step="0.5" min="0.5" max="10"
              value={unitPct}
              onChange={e => saveUnitPct(Number(e.target.value) || 2)}
              className="w-20 bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-white text-center focus:outline-none focus:border-orange-500/50"
            />
            <span className="text-slate-400 text-sm">% of bankroll</span>
            <span className="text-slate-600 text-sm">=</span>
            <span className="text-orange-400 font-bold text-lg">£{unitSize.toFixed(2)} / unit</span>
          </div>
          <div className="flex gap-2 mt-3">
            {[1, 2, 3, 5].map(p => (
              <button key={p} onClick={() => saveUnitPct(p)}
                className={`text-[11px] font-semibold px-2.5 py-1 transition-colors ${
                  unitPct === p ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-white/[0.03] text-slate-500 hover:text-white border border-white/[0.06]'
                }`}>
                {p}%
              </button>
            ))}
          </div>
        </div>

        {/* Kelly calculator */}
        <div className="bg-[#0E1628] border border-white/[0.07] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-sm">Kelly stake calculator</h3>
            <div className="flex gap-1">
              {([0.25, 0.5, 1] as const).map(f => (
                <button key={f} onClick={() => setKFraction(f)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                    kFraction === f ? 'bg-orange-500/20 text-orange-300' : 'text-slate-500 hover:text-white'
                  }`}>
                  {f === 1 ? 'Full' : f === 0.5 ? 'Half' : 'Qtr'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-slate-500 text-xs mb-4">Optimal stake size given edge + odds. Half-Kelly recommended.</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider">Edge (EV%)</label>
              <input type="number" value={kEdge} onChange={e => setKEdge(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider">Odds</label>
              <input type="number" step="0.05" value={kOdds} onChange={e => setKOdds(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </div>
          <div className="bg-orange-500/5 border border-orange-500/25 px-4 py-3 flex items-baseline justify-between">
            <span className="text-orange-300/80 text-xs font-semibold">Suggested stake:</span>
            <div>
              <span className="text-orange-400 font-black text-2xl">£{kellyResult.toFixed(2)}</span>
              <span className="text-slate-500 text-xs ml-2">({currentBalance > 0 ? ((kellyResult / currentBalance) * 100).toFixed(1) : 0}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* GROWTH CHART */}
      <div className="bg-[#0E1628] border border-white/[0.07] p-5">
        <h3 className="text-white font-bold text-sm mb-5">Bankroll growth</h3>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="bankrollGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" stroke="#ffffff10" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
              <YAxis stroke="#ffffff10" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `£${v}`} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={stats.startingBalance} stroke="#ffffff15" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="balance" stroke="#F97316" fill="url(#bankrollGrad)" strokeWidth={2.5}
                dot={{ fill: '#F97316', strokeWidth: 0, r: 3 }}
                activeDot={{ fill: '#FB923C', strokeWidth: 0, r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[260px] flex flex-col items-center justify-center gap-3">
            <p className="text-slate-600 text-sm">Record more snapshots to see your growth chart</p>
          </div>
        )}
      </div>

      {/* MONTHLY P&L */}
      {months.length >= 1 && (
        <div className="bg-[#0E1628] border border-white/[0.07] p-5">
          <h3 className="text-white font-bold text-sm mb-5">Monthly P&amp;L</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={months}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="month" stroke="#ffffff10" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
              <YAxis stroke="#ffffff10" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `£${v}`} tickLine={false} />
              <Tooltip
                cursor={{ fill: '#ffffff05' }}
                contentStyle={{ background: '#0E1628', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}
                formatter={(v: number) => [`£${v.toFixed(2)}`, 'P&L']}
              />
              <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                {months.map((m, i) => (
                  <Cell key={i} fill={m.pnl >= 0 ? '#10B981' : '#EF4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* RECORD SNAPSHOT */}
      <div className="bg-[#0E1628] border border-white/[0.07] p-5">
        <h3 className="text-white font-bold text-sm mb-4">Record balance snapshot</h3>
        <div className="flex gap-3 flex-wrap">
          <input type="number" value={newBalance} onChange={e => setNewBalance(e.target.value)} placeholder="Current balance (£)"
            className="flex-1 min-w-[160px] bg-white/[0.04] border border-white/[0.07] px-4 py-2.5 text-white focus:outline-none focus:border-orange-500/50 placeholder:text-slate-600" />
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
            className="flex-1 min-w-[160px] bg-white/[0.04] border border-white/[0.07] px-4 py-2.5 text-white focus:outline-none focus:border-orange-500/50 placeholder:text-slate-600" />
          <button onClick={recordBalance} disabled={loading || !newBalance}
            className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-2.5 transition-colors disabled:opacity-50 whitespace-nowrap">
            {loading ? 'Saving…' : '+ Record'}
          </button>
        </div>
      </div>

      {/* VARIANCE SIMULATOR (collapsible) */}
      <div className="bg-[#0E1628] border border-white/[0.07] overflow-hidden">
        <button onClick={() => setShowSim(!showSim)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-orange-400">🎲</span>
            <div className="text-left">
              <p className="text-white font-bold text-sm">Variance simulator</p>
              <p className="text-slate-500 text-xs">Monte Carlo — see the realistic range of outcomes over a season</p>
            </div>
          </div>
          <span className={`text-orange-400 transition-transform ${showSim ? 'rotate-45' : ''}`}>+</span>
        </button>
        {showSim && <VarianceSim params={simParams} setParams={setSimParams} />}
      </div>

      {/* HISTORY */}
      {snapshots.length > 0 && (
        <div className="bg-[#0E1628] border border-white/[0.07] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.07]">
            <h3 className="text-white font-bold text-sm">History</h3>
          </div>
          <div className="divide-y divide-white/[0.05] max-h-52 overflow-y-auto">
            {[...snapshots].reverse().map((s, i) => {
              const prev = [...snapshots].reverse()[i + 1]
              const diff = prev ? Number(s.balance) - Number(prev.balance) : null
              return (
                <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 flex-shrink-0 ${i === 0 ? 'bg-orange-400' : 'bg-white/20'}`} />
                    <div>
                      <span className="text-slate-300 text-sm">
                        {new Date(s.recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {s.note && <span className="text-slate-600 text-xs ml-2">— {s.note}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {diff !== null && (
                      <span className={`text-xs font-semibold ${diff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {diff >= 0 ? '+' : ''}£{diff.toFixed(2)}
                      </span>
                    )}
                    <span className="text-white font-bold">£{Number(s.balance).toFixed(2)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* DANGER ZONE — reset everything */}
      <div className="bg-[#0E1628] border border-red-500/20 overflow-hidden">
        <div className="px-5 py-4 border-b border-red-500/15">
          <h3 className="text-xs font-semibold text-red-400 uppercase tracking-widest">Danger Zone</h3>
        </div>
        <div className="flex items-center justify-between px-5 py-4 gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-white">Reset bankroll</p>
            <p className="text-xs text-slate-500 mt-0.5">Permanently deletes all snapshots and sends you back to the setup flow. Useful if you&apos;re changing strategy or starting fresh.</p>
          </div>
          <button
            onClick={resetBankroll}
            disabled={resetting}
            className="shrink-0 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-sm text-red-400 font-semibold transition-colors disabled:opacity-50"
          >
            {resetting ? 'Resetting…' : 'Reset bankroll'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Variance sim sub-component ──────────────────────────────────────────────
function VarianceSim({ params, setParams }: { params: SimParams; setParams: (p: SimParams) => void }) {
  const [result, setResult] = useState<ReturnType<typeof simulateVariance> | null>(null)
  const [running, setRunning] = useState(false)

  function run() {
    setRunning(true)
    // Let UI update first, then run the sim (blocking ~50-200ms for 1000 runs)
    setTimeout(() => {
      setResult(simulateVariance(params, 1000))
      setRunning(false)
    }, 20)
  }

  function Slider({ label, value, onChange, min, max, step, suffix }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; step: number; suffix?: string }) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</label>
          <span className="text-orange-400 text-xs font-bold">{value}{suffix}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-orange-500" />
      </div>
    )
  }

  return (
    <div className="px-5 py-5 border-t border-white/[0.06] space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Slider label="Average edge" value={params.avgEdgePct} onChange={v => setParams({ ...params, avgEdgePct: v })} min={1} max={20} step={1} suffix="%" />
        <Slider label="Average odds" value={params.avgOdds} onChange={v => setParams({ ...params, avgOdds: v })} min={1.3} max={4} step={0.1} />
        <Slider label="Stake per bet" value={params.stakePct} onChange={v => setParams({ ...params, stakePct: v })} min={0.5} max={10} step={0.5} suffix="%" />
        <Slider label="Bets per week" value={params.betsPerWeek} onChange={v => setParams({ ...params, betsPerWeek: v })} min={1} max={30} step={1} />
        <Slider label="Weeks" value={params.weeks} onChange={v => setParams({ ...params, weeks: v })} min={4} max={52} step={1} />
      </div>
      <button onClick={run} disabled={running}
        className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold py-2.5 transition-colors">
        {running ? 'Simulating 1,000 seasons…' : 'Run simulation'}
      </button>

      {result && (
        <div className="bg-white/[0.02] border border-white/[0.06] p-4 space-y-3">
          <p className="text-slate-400 text-xs">
            Starting from <span className="text-white font-semibold">£{params.bankroll.toFixed(2)}</span>, across <span className="text-white font-semibold">{params.weeks}</span> weeks of {params.betsPerWeek} bets/week at {params.stakePct}% stakes:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Median outcome" value={`£${result.median.toFixed(0)}`} color="text-white" />
            <Stat label="Pessimistic (10%)" value={`£${result.p10.toFixed(0)}`} color="text-red-400" />
            <Stat label="Optimistic (10%)" value={`£${result.p90.toFixed(0)}`} color="text-emerald-400" />
            <Stat label="Chance of bust" value={`${result.bustProb}%`} color={result.bustProb > 10 ? 'text-red-400' : 'text-slate-400'} />
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            {result.doubleProb}% of simulated seasons double your bankroll. {result.bustProb}% bust.
            {result.bustProb > 15 && ' → Your stake size is too aggressive for this edge.'}
            {result.bustProb < 5 && result.doubleProb > 40 && ' → Solid risk profile for this model.'}
          </p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0E1628] border border-white/[0.06] px-3 py-2 text-center">
      <p className={`${color} font-bold text-base leading-none`}>{value}</p>
      <p className="text-slate-600 text-[10px] uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}
