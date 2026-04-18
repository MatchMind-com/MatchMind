'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

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
}

export default function BankrollTracker({ userId, initialBankroll, startingBankroll }: Props) {
  const supabase = createClient()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [currentBalance, setCurrentBalance] = useState(initialBankroll)
  const [starting, setStarting] = useState(startingBankroll)
  const [newBalance, setNewBalance] = useState('')
  const [note, setNote] = useState('')
  const [startInput, setStartInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [settingUp, setSettingUp] = useState(startingBankroll === 0)

  useEffect(() => { loadSnapshots() }, [])

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
    // Route through API so service role can bypass RLS on profiles — client-
    // side supabase.from('profiles').update() silently fails, which used to
    // make the setup form reappear on every refresh.
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

  const pnl = currentBalance - starting
  const pnlPct = starting > 0 ? ((pnl / starting) * 100).toFixed(1) : '0.0'
  const chartData = snapshots.map(s => ({
    date: new Date(s.recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    balance: Number(s.balance),
    note: s.note,
  }))

  if (settingUp) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Set Your Starting Bankroll</h2>
          <p className="text-slate-500 mb-6 text-sm">
            Enter the amount you&apos;re starting with to track your growth over time.
          </p>
          <input
            type="number"
            value={startInput}
            onChange={e => setStartInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setupBankroll()}
            placeholder="e.g. 500"
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-white text-xl text-center mb-4 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-colors"
          />
          <button
            onClick={setupBankroll}
            disabled={loading || !startInput}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Start Tracking →'}
          </button>
        </div>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[#0E1628] border border-white/[0.12] rounded-xl p-3 shadow-xl">
        <p className="text-slate-400 text-xs mb-1">{label}</p>
        <p className="text-white font-bold">£{Number(payload[0].value).toFixed(2)}</p>
        {payload[0].payload?.note && (
          <p className="text-blue-400 text-xs mt-1">{payload[0].payload.note}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Current Balance</p>
          <p className="text-4xl font-black text-white leading-none">£{Number(currentBalance).toFixed(2)}</p>
        </div>
        <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Starting Bankroll</p>
          <p className="text-4xl font-black text-slate-400 leading-none">£{Number(starting).toFixed(2)}</p>
        </div>
        <div className={`bg-[#0E1628] rounded-2xl p-5 relative overflow-hidden border ${pnl >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Total Growth</p>
          <p className={`text-4xl font-black leading-none ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}£{Math.abs(pnl).toFixed(2)}
          </p>
          <p className={`text-xs mt-1.5 ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {pnl >= 0 ? '▲' : '▼'} {Math.abs(Number(pnlPct))}% all time
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-5">
        <h3 className="text-white font-bold text-sm mb-5">Bankroll Growth</h3>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="bankrollGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis
                dataKey="date"
                stroke="#ffffff10"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                stroke="#ffffff10"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={v => `£${v}`}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={starting} stroke="#ffffff15" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#3b82f6"
                fill="url(#bankrollGrad)"
                strokeWidth={2.5}
                dot={{ fill: '#3b82f6', strokeWidth: 0, r: 3 }}
                activeDot={{ fill: '#60a5fa', strokeWidth: 0, r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[260px] flex flex-col items-center justify-center gap-3">
            <svg className="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-slate-600 text-sm">Record more snapshots to see your growth chart</p>
          </div>
        )}
      </div>

      {/* Record snapshot */}
      <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-5">
        <h3 className="text-white font-bold text-sm mb-4">Record Balance Snapshot</h3>
        <div className="flex gap-3 flex-wrap">
          <input
            type="number"
            value={newBalance}
            onChange={e => setNewBalance(e.target.value)}
            placeholder="Current balance (£)"
            className="flex-1 min-w-[160px] bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-slate-600"
          />
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="flex-1 min-w-[160px] bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-slate-600"
          />
          <button
            onClick={recordBalance}
            disabled={loading || !newBalance}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? 'Saving…' : '+ Record'}
          </button>
        </div>
      </div>

      {/* History */}
      {snapshots.length > 0 && (
        <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.07]">
            <h3 className="text-white font-bold text-sm">History</h3>
          </div>
          <div className="divide-y divide-white/[0.05] max-h-52 overflow-y-auto">
            {[...snapshots].reverse().map((s, i) => {
              const prev = [...snapshots].reverse()[i + 1]
              const diff = prev ? s.balance - prev.balance : null
              return (
                <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === 0 ? 'bg-blue-400' : 'bg-white/20'}`} />
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
    </div>
  )
}
