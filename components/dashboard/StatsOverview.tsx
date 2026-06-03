'use client'
import { BetSlip } from '@/lib/types'

function computeStats(bets: BetSlip[]) {
  const settled = bets.filter(b => b.result !== 'pending' && b.result !== 'void')
  const wins = settled.filter(b => b.result === 'win')
  const losses = settled.filter(b => b.result === 'loss')
  const totalStake = settled.reduce((sum, b) => sum + Number(b.stake), 0)
  const totalProfit = bets.reduce((sum, b) => sum + Number(b.profit_loss), 0)
  let currentStreak = 0, currentStreakType: 'win'|'loss'|null = null, bestWinStreak = 0, tempStreak = 0
  const sorted = [...settled].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { currentStreakType = sorted[i].result as 'win'|'loss'; currentStreak = 1 }
    else if (sorted[i].result === currentStreakType) currentStreak++
    else break
  }
  [...settled].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach(bet => {
    if (bet.result === 'win') { tempStreak++; bestWinStreak = Math.max(bestWinStreak, tempStreak) } else tempStreak = 0
  })
  return {
    totalBets: bets.length, winningBets: wins.length, losingBets: losses.length,
    pendingBets: bets.filter(b => b.result === 'pending').length,
    winRate: settled.length > 0 ? (wins.length / settled.length) * 100 : 0,
    totalProfit, totalStake, roi: totalStake > 0 ? (totalProfit / totalStake) * 100 : 0,
    avgOdds: settled.length > 0 ? settled.reduce((s,b) => s+Number(b.odds),0)/settled.length : 0,
    avgStake: settled.length > 0 ? totalStake/settled.length : 0,
    currentStreak, currentStreakType, bestWinStreak,
  }
}

function StatCard({ label, value, sub, color='default', icon }: { label:string;value:string;sub?:string;color?:string;icon:React.ReactNode }) {
  const c: Record<string,string> = { default:'text-white', green:'text-emerald-400', red:'text-red-400', orange:'text-orange-400', amber:'text-amber-400' }
  const bg: Record<string,string> = { default:'bg-white/[0.06]', green:'bg-emerald-500/10', red:'bg-red-500/10', orange:'bg-orange-500/10', amber:'bg-amber-500/10' }
  const border: Record<string,string> = { default:'border-white/[0.07]', green:'border-white/[0.07]', red:'border-white/[0.07]', orange:'border-orange-500/20', amber:'border-white/[0.07]' }
  return (
    <div className={`bg-[#13131F] border ${border[color] || 'border-white/[0.07]'} p-5 hover:border-white/[0.12] transition-all`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">{label}</span>
        <div className={`w-7 h-7 ${bg[color]} flex items-center justify-center ${c[color]}`}>{icon}</div>
      </div>
      <div className={`text-2xl font-black ${c[color]} mb-1`}>{value}</div>
      {sub && <div className="text-xs text-slate-600">{sub}</div>}
    </div>
  )
}

export default function StatsOverview({ bets }: { bets: BetSlip[] }) {
  const s = computeStats(bets)
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-lg">Your Performance</h2>
        <span className="text-slate-500 text-sm">{s.totalBets} bets tracked</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Bets" value={String(s.totalBets)} sub={`${s.pendingBets} pending`} color="orange"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}/>
        <StatCard label="Win Rate" value={`${s.winRate.toFixed(1)}%`} sub={`${s.winningBets}W / ${s.losingBets}L`}
          color={s.winRate >= 50 ? 'green' : s.winRate > 0 ? 'amber' : 'default'}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}/>
        <StatCard label="Total P&L" value={`${s.totalProfit >= 0 ? '+' : ''}${s.totalProfit.toFixed(2)}`}
          sub={`Staked: ${s.totalStake.toFixed(2)}`} color={s.totalProfit >= 0 ? 'green' : 'red'}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}/>
        <StatCard label="ROI" value={`${s.roi >= 0 ? '+' : ''}${s.roi.toFixed(1)}%`} sub="Return on investment"
          color={s.roi >= 0 ? 'green' : 'red'}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>}/>
        <StatCard label="Avg Odds" value={s.avgOdds.toFixed(2)} sub="Per settled bet"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}/>
        <StatCard label="Avg Stake" value={s.avgStake.toFixed(2)} sub="Per bet"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}/>
        <StatCard label="Current Streak" color={s.currentStreakType === 'win' ? 'green' : s.currentStreakType === 'loss' ? 'red' : 'default'}
          value={s.currentStreak > 0 ? `${s.currentStreak}` : '—'}
          sub={s.currentStreakType ? `${s.currentStreakType === 'win' ? 'Winning' : 'Losing'} run` : 'No bets yet'}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}/>
        <StatCard label="Best Win Streak" value={s.bestWinStreak > 0 ? `${s.bestWinStreak} wins` : '—'} sub="All time record" color="amber"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}/>
      </div>
    </div>
  )
}
