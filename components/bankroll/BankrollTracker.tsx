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
    await supabase.from('profiles').update({
      starting_bankroll: amount, current_bankroll: amount
    }).eq('id', userId)
    await supabase.from('bankroll_snapshots').insert({
      user_id: userId, balance: amount, note: 'Starting bankroll'
    })
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
    await supabase.from('profiles').update({ current_bankroll: amount }).eq('id', userId)
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
        <div className="bg-[#12121F] border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">💰</div>
          <h2 className="text-2xl font-bold text-white mb-2">Set Your Starting Bankroll</h2>
          <p className="text-white/50 mb-6 text-sm">
            Enter the amount you're starting with to track your growth over time.
          </p>
          <input
            type="number"
            value={startInput}
            onChange={e => setStartInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setupBankroll()}
            placeholder="e.g. 500"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xl text-center mb-4 focus:outline-none focus:border-violet-500 focus:bg-white/8"
          />
          <button
            onClick={setupBankroll}
            disabled={loading || !startInput}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Start Tracking 🚀'}
          </button>
        </div>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[#1a1a2e] border border-white/20 rounded-xl p-3 shadow-xl">
        <p className="text-white/60 text-xs mb-1">{label}</p>
        <p className="text-white font-bold">£{Number(payload[0].value).toFixed(2)}</p>
        {payload[0].payload?.note && (
          <p className="text-violet-400 text-xs mt-1">{payload[0].payload.note}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#12121F] border border-violet-500/20 rounded-2xl p-6">
          <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Current Balance</p>
          <p className="text-3xl font-black text-white">£{Number(currentBalance).toFixed(2)}</p>
        </div>
        <div className="bg-[#12121F] border border-white/10 rounded-2xl p-6">
          <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Starting Bankroll</p>
          <p className="text-3xl font-bold text-white/70">£{Number(starting).toFixed(2)}</p>
        </div>
        <div className={`bg-[#12121F] border rounded-2xl p-6 ${pnl >= 0 ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
          <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Total Growth</p>
          <p className={`text-3xl font-black ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}£{pnl.toFixed(2)}
          </p>
          <p className={`text-sm mt-1 ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {pnl >= 0 ? '▲' : '▼'} {Math.abs(Number(pnlPct))}% all time
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#12121F] border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-5">📈 Bankroll Growth Chart</h3>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="bankrollGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" />
              <XAxis
                dataKey="date"
                stroke="#ffffff20"
                tick={{ fill: '#ffffff50', fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                stroke="#ffffff20"
                tick={{ fill: '#ffffff50', fontSize: 11 }}
                tickFormatter={v => `£${v}`}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={starting} stroke="#ffffff20" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#7c3aed"
                fill="url(#bankrollGrad)"
                strokeWidth={2.5}
                dot={{ fill: '#7c3aed', strokeWidth: 0, r: 3 }}
                activeDot={{ fill: '#a78bfa', strokeWidth: 0, r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex flex-col items-center justify-center text-white/20 gap-3">
            <div className="text-5xl">📊</div>
            <p className="text-sm">Record more balance snapshots to see your growth chart</p>
          </div>
        )}
      </div>

      {/* Record snapshot */}
      <div className="bg-[#12121F] border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4">Record Balance Snapshot</h3>
        <div className="flex gap-3 flex-wrap">
          <input
            type="number"
            value={newBalance}
            onChange={e => setNewBalance(e.target.value)}
            placeholder="Current balance (£)"
            className="flex-1 min-w-[160px] bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
          />
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="flex-1 min-w-[160px] bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={recordBalance}
            disabled={loading || !newBalance}
            className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? 'Saving...' : '+ Record'}
          </button>
        </div>
      </div>

      {/* History */}
      {snapshots.length > 0 && (
        <div className="bg-[#12121F] border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">History</h3>
          <div className="space-y-0 max-h-52 overflow-y-auto">
            {[...snapshots].reverse().map((s, i) => {
              const prev = [...snapshots].reverse()[i + 1]
              const diff = prev ? s.balance - prev.balance : null
              return (
                <div key={s.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-violet-400' : 'bg-white/20'}`} />
                    <div>
                      <span className="text-white/70 text-sm">
                        {new Date(s.recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {s.note && <span className="text-white/30 text-xs ml-2">— {s.note}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {diff !== null && (
                      <span className={`text-xs ${diff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {diff >= 0 ? '+' : ''}£{diff.toFixed(2)}
                      </span>
                    )}
                    <span className="text-white font-semibold">£{Number(s.balance).toFixed(2)}</span>
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
