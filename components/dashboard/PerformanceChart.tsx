'use client'
import { useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { BetSlip } from '@/lib/types'

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  const pos = v >= 0
  return (
    <div className="bg-[#161B26] border border-white/[0.12] p-3 text-sm shadow-xl">
      <div className="text-slate-500 mb-1 text-xs">{label}</div>
      <div className={`font-bold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
        {pos ? '+' : ''}{typeof v === 'number' ? v.toFixed(2) : v}
      </div>
    </div>
  )
}

export default function PerformanceChart({ bets }: { bets: BetSlip[] }) {
  const [view, setView] = useState<'pnl' | 'roi_league' | 'roi_type'>('pnl')

  const settled = bets.filter(b => b.result !== 'pending' && b.result !== 'void')

  const pnlData = settled
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .reduce<{ name: string; cumulative: number }[]>((acc, bet, i) => {
      const prev = acc[i - 1]?.cumulative ?? 0
      acc.push({ name: `Bet ${i + 1}`, cumulative: parseFloat((prev + Number(bet.profit_loss)).toFixed(2)) })
      return acc
    }, [])

  function buildBreakdown(key: 'league' | 'bet_type') {
    const map: Record<string, { stake: number; profit: number; count: number }> = {}
    settled.forEach(b => {
      const k = (b[key] || 'Other') as string
      if (!map[k]) map[k] = { stake: 0, profit: 0, count: 0 }
      map[k].stake += Number(b.stake)
      map[k].profit += Number(b.profit_loss)
      map[k].count++
    })
    return Object.entries(map)
      .map(([name, { stake, profit, count }]) => ({
        name: name.length > 14 ? name.substring(0, 14) + '…' : name,
        roi: stake > 0 ? parseFloat(((profit / stake) * 100).toFixed(1)) : 0,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }

  const leagueData = buildBreakdown('league')
  const typeData = buildBreakdown('bet_type')
  const isEmpty = settled.length === 0

  const TABS = [
    { key: 'pnl' as const, label: 'P&L Over Time' },
    { key: 'roi_league' as const, label: 'By League' },
    { key: 'roi_type' as const, label: 'By Bet Type' },
  ]

  return (
    <div className="bg-[#161B26] border border-white/[0.07] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">Performance Analytics</h2>
            <p className="text-slate-500 text-xs">{settled.length} settled bets</p>
          </div>
        </div>

        {!isEmpty && (
          <div className="flex bg-white/[0.04] border border-white/[0.07] p-1 gap-1">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`text-xs px-3 py-1.5 transition-all font-semibold ${
                  view === key
                    ? 'bg-orange-500/15 border border-orange-500/25 text-orange-400'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart area */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-52 text-center gap-3">
          <svg className="w-10 h-10 text-white/10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <div>
            <p className="text-white/40 font-medium text-sm">No data yet</p>
            <p className="text-white/20 text-xs mt-1">Mark bets as won/lost to see your charts</p>
          </div>
        </div>
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            {view === 'pnl' ? (
              <LineChart data={pnlData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <ReferenceLine y={0} stroke="#ffffff15" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: '#f97316', stroke: '#0D1117', strokeWidth: 2 }}
                />
              </LineChart>
            ) : (
              <BarChart
                data={view === 'roi_league' ? leagueData : typeData}
                margin={{ top: 5, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#475569', fontSize: 10 }}
                  angle={-25}
                  textAnchor="end"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<Tip />} />
                <ReferenceLine y={0} stroke="#ffffff15" strokeDasharray="4 4" />
                <Bar dataKey="roi">
                  {(view === 'roi_league' ? leagueData : typeData).map((e, i) => (
                    <Cell key={i} fill={e.roi >= 0 ? '#10B981' : '#EF4444'} opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
