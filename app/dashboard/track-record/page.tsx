import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

async function getTrackRecord() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://footballbetai.vercel.app'}/api/track-record`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) throw new Error()
    return await res.json()
  } catch {
    return { stats: null, byLeague: [], byBetType: [], recent: [], chartData: [] }
  }
}

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, string> = {
    win: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    loss: 'text-red-400 bg-red-500/10 border-red-500/15',
    void: 'text-white/40 bg-white/5 border-white/10',
  }
  const label: Record<string, string> = { win: 'Won', loss: 'Lost', void: 'Void' }
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${map[result] || ''}`}>
      {label[result] || result}
    </span>
  )
}

export default async function DashboardTrackRecordPage() {
  const { stats, byLeague, byBetType, recent } = await getTrackRecord()
  const hasData = stats && stats.total > 0

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-emerald-400 text-xs font-semibold">Auto-verified against live results</p>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">AI Track Record</h1>
          <p className="text-slate-500 text-sm mt-1">Every prediction logged before kickoff. No cherry-picking.</p>
        </div>
        <a href="/track-record" target="_blank" rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-blue-400 flex items-center gap-1 transition-colors">
          Public page
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {!hasData ? (
        <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-10 text-center">
          <p className="text-white font-bold text-lg mb-2">Building the record</p>
          <p className="text-slate-500 text-sm">Our AI makes predictions daily. Results are auto-verified after each match finishes. Check back soon.</p>
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Tips', value: String(stats.total), sub: `${stats.wins}W · ${stats.losses}L · ${stats.voids} void`, color: 'text-white' },
              { label: 'Win Rate', value: `${stats.winRate}%`, sub: `${stats.wins}W · ${stats.losses}L · ${stats.voids} void`, color: stats.winRate >= 55 ? 'text-emerald-400' : 'text-white' },
              { label: 'Total P&L', value: `${stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit}u`, sub: `${stats.wins}W · ${stats.losses}L · ${stats.voids} void`, color: stats.totalProfit > 0 ? 'text-emerald-400' : stats.totalProfit < 0 ? 'text-red-400' : 'text-white' },
              { label: 'ROI', value: `${stats.roi >= 0 ? '+' : ''}${stats.roi}%`, sub: `${stats.wins}W · ${stats.losses}L · ${stats.voids} void`, color: stats.roi > 0 ? 'text-emerald-400' : stats.roi < 0 ? 'text-red-400' : 'text-white' },
            ].map(s => (
              <div key={s.label} className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-5">
                <p className="text-slate-500 text-xs mb-2">{s.label}</p>
                <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-slate-600 text-[10px] mt-1">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Value bets highlight */}
          {stats.valueBets?.total > 0 && (
            <div className="bg-[#0E1628] border border-emerald-500/25 rounded-2xl p-5"
              style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(14,22,40,1) 100%)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Value Bets Performance</p>
                  <p className="text-slate-500 text-xs">High EV% picks only — our best calls</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-emerald-400 text-2xl font-black">{stats.valueBets.winRate}%</p>
                  <p className="text-slate-500 text-xs mt-0.5">Win Rate</p>
                </div>
                <div>
                  <p className={`text-2xl font-black ${stats.valueBets.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {stats.valueBets.roi >= 0 ? '+' : ''}{stats.valueBets.roi}%
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">ROI</p>
                </div>
                <div>
                  <p className="text-blue-400 text-2xl font-black">{stats.valueBets.total}</p>
                  <p className="text-slate-500 text-xs mt-0.5">Tips</p>
                </div>
              </div>
            </div>
          )}

          {/* By League + By Bet Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {byLeague.length > 0 && (
              <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-5">
                <p className="text-white font-bold text-sm mb-4">By League</p>
                <div className="space-y-3">
                  {byLeague.slice(0, 6).map((l: any) => (
                    <div key={l.league}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-white text-sm font-medium truncate">{l.league}</p>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-slate-500 text-xs">{l.wins}W·{l.losses}L</span>
                          <span className={`text-xs font-bold ${l.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {l.profit >= 0 ? '+' : ''}{l.profit}u
                          </span>
                          <span className="text-slate-600 text-xs w-8 text-right">{l.winRate}%</span>
                        </div>
                      </div>
                      <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${l.winRate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {byBetType.length > 0 && (
              <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-5">
                <p className="text-white font-bold text-sm mb-4">By Bet Type</p>
                <div className="space-y-3">
                  {byBetType.slice(0, 6).map((t: any) => (
                    <div key={t.type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="bg-blue-500/15 text-blue-300 text-xs px-2 py-0.5 rounded-lg border border-blue-500/20 font-semibold shrink-0">{t.type}</span>
                        <span className="text-slate-500 text-xs">{t.wins}W · {t.losses}L</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-400 text-xs">{t.winRate}%</span>
                        <span className={`text-sm font-bold ${t.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.profit >= 0 ? '+' : ''}{t.profit}u
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent predictions */}
          <div className="bg-[#0E1628] border border-white/[0.07] rounded-2xl p-5">
            <p className="text-white font-bold text-sm mb-4">Recent Verified Predictions</p>
            <div className="space-y-2.5">
              {recent.map((r: any) => {
                const kickOff = new Date(r.kick_off).toLocaleDateString('en-GB', {
                  weekday: 'short', day: 'numeric', month: 'short'
                })
                return (
                  <div key={r.id} className={`border rounded-xl p-4 ${
                    r.result === 'win' ? 'bg-emerald-500/[0.04] border-emerald-500/20' :
                    r.result === 'loss' ? 'bg-red-500/[0.04] border-red-500/15' :
                    'bg-white/[0.02] border-white/[0.07]'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm truncate">{r.home_team} vs {r.away_team}</p>
                        <p className="text-slate-500 text-xs">{r.league} · {kickOff}</p>
                        {r.home_score !== null && (
                          <p className="text-slate-400 text-xs mt-0.5 font-semibold">Final: {r.home_score} – {r.away_score}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <ResultBadge result={r.result} />
                        {r.is_value_bet && (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-semibold">Value</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="bg-blue-500/15 text-blue-300 text-xs font-semibold px-2 py-0.5 rounded-lg border border-blue-500/20">{r.bet_type}</span>
                      {r.odds && <span className="text-white text-xs font-bold">@ {r.odds}</span>}
                      {r.ev_percent && <span className="text-emerald-400 text-xs font-bold">+{r.ev_percent}% EV</span>}
                      {r.profit_loss !== null && (
                        <span className={`text-xs font-bold ml-auto ${r.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.profit_loss >= 0 ? '+' : ''}{r.profit_loss}u
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
