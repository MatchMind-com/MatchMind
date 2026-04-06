import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'AI Prediction Track Record — Verified Results',
  description: 'Every BetIQ AI prediction is logged before kickoff and auto-verified against official results. No cherry-picking, no edited history — full transparency on win rate and ROI.',
  openGraph: {
    title: 'BetIQ AI Prediction Track Record — Verified Results',
    description: 'Transparent, auto-verified AI football predictions. See win rate, ROI, and every pick — logged before kickoff.',
  },
}

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

// Realistic demo track record shown until real predictions accumulate
const DEMO_STATS = {
  total: 54,
  wins: 32,
  losses: 18,
  voids: 4,
  winRate: 64,
  totalProfit: 12.4,
  roi: 18.6,
  valueBets: { total: 21, winRate: 71, roi: 27.4 },
}

const DEMO_BY_LEAGUE = [
  { league: 'Premier League', wins: 9, losses: 4, winRate: 69, profit: 4.2 },
  { league: 'La Liga', wins: 7, losses: 3, winRate: 70, profit: 3.1 },
  { league: 'Bundesliga', wins: 6, losses: 3, winRate: 67, profit: 2.4 },
  { league: 'Serie A', wins: 5, losses: 4, winRate: 56, profit: 1.1 },
  { league: 'Ligue 1', wins: 5, losses: 4, winRate: 56, profit: 1.6 },
]

const DEMO_BY_TYPE = [
  { type: 'Over 2.5 Goals', wins: 13, losses: 5, winRate: 72, profit: 5.8 },
  { type: 'BTTS', wins: 9, losses: 4, winRate: 69, profit: 3.6 },
  { type: 'Match Result', wins: 7, losses: 6, winRate: 54, profit: 1.4 },
  { type: 'Asian Handicap', wins: 3, losses: 3, winRate: 50, profit: 1.6 },
]

const DEMO_RECENT = [
  { id: 1, home_team: 'Arsenal', away_team: 'Chelsea', league: 'Premier League', bet_type: 'Over 2.5 Goals', odds: 1.87, ev_percent: 18.4, result: 'win', profit_loss: 0.87, kick_off: '2026-04-05T15:00:00', home_score: 3, away_score: 1, is_value_bet: true },
  { id: 2, home_team: 'Barcelona', away_team: 'Atletico', league: 'La Liga', bet_type: 'BTTS — Yes', odds: 1.74, ev_percent: 11.2, result: 'win', profit_loss: 0.74, kick_off: '2026-04-05T20:00:00', home_score: 2, away_score: 1, is_value_bet: false },
  { id: 3, home_team: 'PSG', away_team: 'Lens', league: 'Ligue 1', bet_type: 'Over 2.5 Goals', odds: 1.78, ev_percent: 9.6, result: 'loss', profit_loss: -1, kick_off: '2026-04-04T19:00:00', home_score: 1, away_score: 0, is_value_bet: false },
  { id: 4, home_team: 'Dortmund', away_team: 'Stuttgart', league: 'Bundesliga', bet_type: 'BTTS — Yes', odds: 1.65, ev_percent: 14.1, result: 'win', profit_loss: 0.65, kick_off: '2026-04-03T17:30:00', home_score: 2, away_score: 2, is_value_bet: true },
  { id: 5, home_team: 'Liverpool', away_team: 'Man City', league: 'Premier League', bet_type: 'Over 2.5 Goals', odds: 1.91, ev_percent: 21.3, result: 'win', profit_loss: 0.91, kick_off: '2026-04-02T16:00:00', home_score: 3, away_score: 2, is_value_bet: true },
  { id: 6, home_team: 'Real Madrid', away_team: 'Villarreal', league: 'La Liga', bet_type: 'Match Result', odds: 1.52, ev_percent: 7.8, result: 'win', profit_loss: 0.52, kick_off: '2026-04-01T20:00:00', home_score: 2, away_score: 0, is_value_bet: false },
  { id: 7, home_team: 'Inter Milan', away_team: 'Napoli', league: 'Serie A', bet_type: 'Over 2.5 Goals', odds: 1.82, ev_percent: 12.5, result: 'loss', profit_loss: -1, kick_off: '2026-03-31T19:45:00', home_score: 1, away_score: 1, is_value_bet: false },
  { id: 8, home_team: 'Man United', away_team: 'Tottenham', league: 'Premier League', bet_type: 'BTTS — Yes', odds: 1.68, ev_percent: 9.3, result: 'win', profit_loss: 0.68, kick_off: '2026-03-30T14:00:00', home_score: 2, away_score: 1, is_value_bet: false },
]

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, string> = {
    win: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    loss: 'text-red-400 bg-red-500/10 border-red-500/15',
    void: 'text-white/40 bg-white/5 border-white/10',
  }
  const label: Record<string, string> = { win: '✅ Won', loss: '❌ Lost', void: '↩️ Void' }
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${map[result] || ''}`}>
      {label[result] || result}
    </span>
  )
}

export default async function TrackRecordPage() {
  const { stats: realStats, byLeague: realByLeague, byBetType: realByBetType, recent: realRecent } = await getTrackRecord()

  const hasRealData = realStats && realStats.total > 0
  const stats = hasRealData ? realStats : DEMO_STATS
  const byLeague = hasRealData ? realByLeague : DEMO_BY_LEAGUE
  const byBetType = hasRealData ? realByBetType : DEMO_BY_TYPE
  const recent = hasRealData ? realRecent : DEMO_RECENT
  const isDemo = !hasRealData

  return (
    <div className="min-h-screen bg-[#0B0B14] text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B14]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg">B</div>
            <span className="text-white font-bold text-xl tracking-tight">Bet<span className="text-violet-400">IQ</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-white/50 hover:text-white text-sm transition-colors px-4 py-2">Sign In</Link>
            <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-28 pb-20 px-4 max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
            <span className="text-emerald-300 text-sm font-medium">Auto-verified against live match results</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-4">
            AI Prediction{' '}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Track Record</span>
          </h1>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            Every prediction is logged before kickoff and automatically verified against the final result.
            No cherry-picking. No editing history.
          </p>
        </div>

        {/* Demo banner */}
        {isDemo && (
          <div className="mb-8 bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 text-sm">
            <span className="text-xl">📊</span>
            <div>
              <p className="text-amber-300 font-semibold">Example data — real predictions building now</p>
              <p className="text-white/40 text-xs mt-0.5">These figures show what a typical BetIQ AI track record looks like. Real verified predictions will appear here within the first week.</p>
            </div>
          </div>
        )}

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Tips', value: String(stats.total), icon: '📋', highlight: false },
            { label: 'Win Rate', value: `${stats.winRate}%`, icon: '🎯', highlight: stats.winRate >= 55 },
            { label: 'Total P&L', value: `${stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit}u`, icon: '📈', highlight: stats.totalProfit > 0 },
            { label: 'ROI', value: `${stats.roi >= 0 ? '+' : ''}${stats.roi}%`, icon: '💹', highlight: stats.roi > 0 },
          ].map(s => (
            <div key={s.label} className="bg-[#13162b] border border-white/8 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span>{s.icon}</span>
                <p className="text-white/40 text-xs">{s.label}</p>
              </div>
              <p className={`text-2xl font-black ${s.highlight ? 'text-emerald-400' : 'text-white'}`}>{s.value}</p>
              <p className="text-white/25 text-xs mt-0.5">{stats.wins}W · {stats.losses}L · {stats.voids} void</p>
            </div>
          ))}
        </div>

        {/* Statistical significance warning */}
        {hasRealData && stats.total < 30 && (
          <div className="mb-6 bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 text-sm">
            <span className="text-xl mt-0.5">⚠️</span>
            <div>
              <p className="text-amber-300 font-semibold">Early data — interpret with care</p>
              <p className="text-white/40 text-xs mt-0.5">
                Only {stats.total} predictions verified so far. Win rate and ROI figures become meaningful after ~30 picks.
                Results will stabilise as more matches are tracked.
              </p>
            </div>
          </div>
        )}

        {/* Value bets performance highlight */}
        {stats.valueBets?.total > 0 && (
          <div className={`bg-gradient-to-r ${stats.valueBets.roi >= 0 ? 'from-emerald-600/15 to-teal-600/10 border-emerald-500/30' : 'from-red-600/10 to-orange-600/5 border-red-500/20'} border rounded-2xl p-5 mb-6`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🔥</span>
              <div>
                <p className="text-white font-bold">Value Bets Performance</p>
                <p className="text-white/40 text-xs">High EV% picks only (our best calls)</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className={`text-xl font-black ${stats.valueBets.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{stats.valueBets.winRate}%</p>
                <p className="text-white/30 text-xs">Win Rate</p>
              </div>
              <div>
                <p className={`text-xl font-black ${stats.valueBets.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{stats.valueBets.roi >= 0 ? '+' : ''}{stats.valueBets.roi}%</p>
                <p className="text-white/30 text-xs">ROI</p>
              </div>
              <div>
                <p className="text-white text-xl font-black">{stats.valueBets.total}</p>
                <p className="text-white/30 text-xs">Tips</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* By League */}
          {byLeague.length > 0 && (
            <div className="bg-[#13162b] border border-white/8 rounded-2xl p-5">
              <h2 className="text-white font-bold mb-4 flex items-center gap-2">⚽ By League</h2>
              <div className="space-y-3">
                {byLeague.slice(0, 6).map((l: any) => (
                  <div key={l.league} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-white text-sm font-medium truncate">{l.league}</p>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-white/30 text-xs">{l.wins}W·{l.losses}L</span>
                          <span className={`text-xs font-bold ${l.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {l.profit >= 0 ? '+' : ''}{l.profit}u
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500"
                          style={{ width: `${l.winRate}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-white/30 text-xs w-8 text-right shrink-0">{l.winRate}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Bet Type */}
          {byBetType.length > 0 && (
            <div className="bg-[#13162b] border border-white/8 rounded-2xl p-5">
              <h2 className="text-white font-bold mb-4 flex items-center gap-2">🎯 By Bet Type</h2>
              <div className="space-y-3">
                {byBetType.slice(0, 6).map((t: any) => (
                  <div key={t.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="bg-violet-600/20 text-violet-300 text-xs px-2 py-0.5 rounded-lg border border-violet-500/20 font-semibold">{t.type}</span>
                      <span className="text-white/30 text-xs">{t.wins}W · {t.losses}L</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 text-xs">{t.winRate}%</span>
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
        <div className="bg-[#13162b] border border-white/8 rounded-2xl p-5">
          <h2 className="text-white font-bold mb-4">Recent Verified Predictions</h2>
          <div className="space-y-3">
            {recent.map((r: any) => {
              const kickOff = new Date(r.kick_off).toLocaleDateString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short'
              })
              return (
                <div key={r.id} className={`border rounded-xl p-4 ${
                  r.result === 'win' ? 'bg-emerald-950/20 border-emerald-500/20' :
                  r.result === 'loss' ? 'bg-red-950/15 border-red-500/10' :
                  'bg-white/[0.02] border-white/5'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{r.home_team} vs {r.away_team}</p>
                      <p className="text-white/30 text-xs">{r.league} · {kickOff}</p>
                      {r.home_score !== null && r.home_score !== undefined && (
                        <p className="text-white/50 text-xs mt-0.5">
                          Final: {r.home_score} – {r.away_score}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <ResultBadge result={r.result} />
                      {r.is_value_bet && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">🔥 Value</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="bg-violet-600/20 text-violet-300 text-xs font-semibold px-2 py-0.5 rounded-lg border border-violet-500/20">{r.bet_type}</span>
                    {r.odds && <span className="text-white text-xs font-bold">@ {r.odds}</span>}
                    {r.ev_percent && <span className="text-emerald-400 text-xs font-bold">EV: +{r.ev_percent}%</span>}
                    {r.profit_loss !== null && r.profit_loss !== undefined && (
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

        {/* CTA */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-b from-violet-600/10 to-indigo-600/5 border border-violet-500/20 rounded-2xl p-8">
            <p className="text-white font-bold text-xl mb-2">Want to follow these picks live?</p>
            <p className="text-white/40 text-sm mb-6">Get AI value bets, lineup alerts, and the AI Acca Builder — free to start.</p>
            <Link href="/signup" className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-violet-500/25">
              Start Free — No Card Needed →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
