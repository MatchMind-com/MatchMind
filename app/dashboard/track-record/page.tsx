import { createClient } from '@/lib/supabase/server'

async function getTrackRecord() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'}/api/track-record`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) throw new Error()
    return await res.json()
  } catch {
    return { stats: null, byLeague: [], byBetType: [], recent: [], chartData: [], topCLV: [] }
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
    <span className={`text-xs font-bold px-2 py-0.5 border ${map[result] || ''}`}>
      {label[result] || result}
    </span>
  )
}

function CLVBadge({ clv }: { clv: number }) {
  const isPositive = clv >= 0
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 border ${
      isPositive
        ? 'text-orange-400 bg-orange-500/10 border-orange-500/20'
        : 'text-slate-500 bg-white/5 border-white/10'
    }`}>
      CLV {isPositive ? '+' : ''}{clv}%
    </span>
  )
}

export default async function DashboardTrackRecordPage() {
  const { stats, byLeague, byBetType, recent, topCLV } = await getTrackRecord()
  const hasData = stats && stats.total > 0
  const hasCLV = stats?.clv?.tracked > 0

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-emerald-400 animate-pulse" />
            <p className="text-emerald-400 text-xs font-semibold">Auto-verified against live results</p>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">AI Track Record</h1>
          <p className="text-slate-500 text-sm mt-1">Every prediction logged before kickoff. No cherry-picking.</p>
        </div>
        <a href="/track-record" target="_blank" rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-orange-400 flex items-center gap-1 transition-colors">
          Public page
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {!hasData ? (
        <div className="bg-[#0E1628] border border-white/[0.07] p-10 text-center">
          <p className="text-white font-bold text-lg mb-2">Building the record</p>
          <p className="text-slate-500 text-sm">Our AI makes predictions daily. Results are auto-verified after each match finishes. Check back soon.</p>
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Tips', value: String(stats.total), sub: `${stats.wins}W · ${stats.losses}L · ${stats.voids} void`, color: 'text-white' },
              { label: 'Win Rate', value: `${stats.winRate}%`, sub: `${stats.wins}W · ${stats.losses}L`, color: stats.winRate >= 55 ? 'text-emerald-400' : 'text-white' },
              { label: 'Total P&L', value: `${stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit}u`, sub: `at 1 unit per tip`, color: stats.totalProfit > 0 ? 'text-emerald-400' : stats.totalProfit < 0 ? 'text-red-400' : 'text-white' },
              { label: 'ROI', value: `${stats.roi >= 0 ? '+' : ''}${stats.roi}%`, sub: `per unit staked`, color: stats.roi > 0 ? 'text-emerald-400' : stats.roi < 0 ? 'text-red-400' : 'text-white' },
            ].map(s => (
              <div key={s.label} className="bg-[#0E1628] border border-white/[0.07] p-5">
                <p className="text-slate-500 text-xs mb-2">{s.label}</p>
                <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-slate-600 text-[10px] mt-1">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* ── CLV Hero Block ───────────────────────────────────────────── */}
          {hasCLV ? (
            <div className="bg-[#0E1628] border border-orange-500/25 p-6"
              style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.07) 0%, rgba(14,22,40,1) 60%)' }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                  {/* Target / closing line icon */}
                  <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-bold text-base">Closing Line Value (CLV)</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Did we beat Pinnacle's closing odds? Positive CLV = we found real edge before the sharp money moved the line.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center mb-5">
                <div>
                  <p className={`text-3xl font-black ${stats.clv.avgCLV >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                    {stats.clv.avgCLV !== null ? `${stats.clv.avgCLV >= 0 ? '+' : ''}${stats.clv.avgCLV}%` : '—'}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">Avg CLV</p>
                </div>
                <div>
                  <p className={`text-3xl font-black ${stats.clv.beatRate >= 50 ? 'text-orange-400' : 'text-white'}`}>
                    {stats.clv.beatRate !== null ? `${stats.clv.beatRate}%` : '—'}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">Beat the Close</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">{stats.clv.tracked}</p>
                  <p className="text-slate-500 text-xs mt-1">Tips Tracked</p>
                </div>
              </div>

              {/* CLV explanation bar */}
              {stats.clv.beatRate !== null && (
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>Beat the close ({stats.clv.beatRate}%)</span>
                    <span>Didn&apos;t beat ({100 - stats.clv.beatRate}%)</span>
                  </div>
                  <div className="w-full h-2 bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${stats.clv.beatRate}%`,
                        background: 'linear-gradient(90deg, #f97316, #fb923c)',
                      }}
                    />
                  </div>
                  <p className="text-slate-600 text-[10px] mt-2">
                    Consistently beating the closing line above 50% is strong evidence of real edge — independent of short-term win/loss variance.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* CLV coming soon teaser — before enough predictions are verified */
            <div className="bg-[#0E1628] border border-orange-500/15 p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm">Closing Line Value tracking live</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  CLV data populates automatically as matches complete. Each verified prediction is compared against Pinnacle&apos;s closing odds.
                </p>
              </div>
            </div>
          )}

          {/* Value bets highlight */}
          {stats.valueBets?.total > 0 && (
            <div className="bg-[#0E1628] border border-emerald-500/25 p-5"
              style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(14,22,40,1) 100%)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
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
                  <p className="text-white text-2xl font-black">{stats.valueBets.total}</p>
                  <p className="text-slate-500 text-xs mt-0.5">Tips</p>
                </div>
              </div>
            </div>
          )}

          {/* By League + By Bet Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {byLeague.length > 0 && (
              <div className="bg-[#0E1628] border border-white/[0.07] p-5">
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
                      <div className="w-full h-1 bg-white/[0.05] overflow-hidden">
                        <div className="h-full bg-orange-500" style={{ width: `${l.winRate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {byBetType.length > 0 && (
              <div className="bg-[#0E1628] border border-white/[0.07] p-5">
                <p className="text-white font-bold text-sm mb-4">By Bet Type</p>
                <div className="space-y-3">
                  {byBetType.slice(0, 6).map((t: any) => (
                    <div key={t.type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="bg-orange-500/10 text-orange-400 text-xs px-2 py-0.5 border border-orange-500/20 font-semibold shrink-0">{t.type}</span>
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

          {/* Top CLV predictions */}
          {topCLV && topCLV.length > 0 && (
            <div className="bg-[#0E1628] border border-white/[0.07] p-5">
              <div className="flex items-center gap-2 mb-4">
                <p className="text-white font-bold text-sm">Best CLV Predictions</p>
                <span className="text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 font-semibold">Closing Line Edge</span>
              </div>
              <div className="space-y-2.5">
                {topCLV.map((r: any) => {
                  const kickOff = new Date(r.kick_off).toLocaleDateString('en-GB', {
                    weekday: 'short', day: 'numeric', month: 'short'
                  })
                  return (
                    <div key={r.id} className="border border-orange-500/15 bg-orange-500/[0.03] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-white font-bold text-sm truncate">{r.home_team} vs {r.away_team}</p>
                          <p className="text-slate-500 text-xs">{kickOff}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <CLVBadge clv={r.clv_percent} />
                          <ResultBadge result={r.result} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="bg-orange-500/10 text-orange-400 text-xs font-semibold px-2 py-0.5 border border-orange-500/20">{r.bet_type}</span>
                        {r.odds && <span className="text-white text-xs font-bold">@ {r.odds}</span>}
                        {r.closing_odds && (
                          <span className="text-slate-500 text-xs">closed {r.closing_odds}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent predictions */}
          <div className="bg-[#0E1628] border border-white/[0.07] p-5">
            <p className="text-white font-bold text-sm mb-4">Recent Verified Predictions</p>
            <div className="space-y-2.5">
              {recent.map((r: any) => {
                const kickOff = new Date(r.kick_off).toLocaleDateString('en-GB', {
                  weekday: 'short', day: 'numeric', month: 'short'
                })
                return (
                  <div key={r.id} className={`border p-4 ${
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
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 font-semibold">Value</span>
                        )}
                        {r.clv_percent !== null && r.clv_percent !== undefined && (
                          <CLVBadge clv={r.clv_percent} />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="bg-orange-500/10 text-orange-400 text-xs font-semibold px-2 py-0.5 border border-orange-500/20">{r.bet_type}</span>
                      {r.odds && <span className="text-white text-xs font-bold">@ {r.odds}</span>}
                      {r.closing_odds && <span className="text-slate-500 text-xs">closed {r.closing_odds}</span>}
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
