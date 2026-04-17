'use client'
import { useEffect, useState } from 'react'

interface MatchStats {
  possession: number | null
  shots_total: number | null
  shots_on_goal: number | null
  xg: number | null
  corners: number | null
  fouls: number | null
  yellow_cards: number | null
  red_cards: number | null
  saves: number | null
  passes_total: number | null
  passes_accurate: number | null
  pass_accuracy: number | null
  offsides: number | null
}

interface TeamSeasonStats {
  played: number; wins: number; draws: number; losses: number; win_rate: number
  goals_for: number; goals_against: number; goals_for_avg: number; goals_against_avg: number
  home: { goals_for: number; goals_against: number; wins: number; draws: number; losses: number }
  away: { goals_for: number; goals_against: number; wins: number; draws: number; losses: number }
  clean_sheets: number; clean_sheet_pct: number
  failed_to_score: number; failed_to_score_pct: number
  yellow_cards_total: number; yellow_cards_avg: number
  red_cards_total: number
  biggest_win: string | null; biggest_loss: string | null
  penalties_scored: number; penalties_missed: number
  top_formation: string | null; form: string | null
}

interface MatchDetail {
  fixture: { id: number; date: string; status: string; elapsed: number | null; venue: string; city: string; referee: string }
  league: { id: number; name: string; logo: string; round: string }
  home: { id: number; name: string; logo: string; goals: number | null; injuries: Injury[]; form: FormMatch[] }
  away: { id: number; name: string; logo: string; goals: number | null; injuries: Injury[]; form: FormMatch[] }
  h2h: H2HMatch[]
  prediction: Prediction | null
  statistics: { home: MatchStats; away: MatchStats } | null
  home_stats: TeamSeasonStats | null
  away_stats: TeamSeasonStats | null
}

interface Injury { player: string; photo?: string; reason: string; type: string }
interface FormMatch { date: string; opponent: string; score: string; result: 'W' | 'L' | 'D'; isHome: boolean }
interface H2HMatch { date: string; homeTeam: string; awayTeam: string; homeGoals: number; awayGoals: number; winner: string }
interface Prediction { winner: string; advice: string; homeWinPercent: string; drawPercent: string; awayWinPercent: string }

function FormDot({ result }: { result: 'W' | 'L' | 'D' }) {
  const colors = { W: 'bg-emerald-500', L: 'bg-red-500', D: 'bg-slate-500' }
  return (
    <div className={`w-6 h-6 rounded-full ${colors[result]} flex items-center justify-center`}>
      <span className="text-[10px] font-black text-white">{result}</span>
    </div>
  )
}

// SofaScore-style comparison bar
function StatRow({
  label,
  home,
  away,
  isPercent = false,
  highlight = false,
}: {
  label: string
  home: number | null
  away: number | null
  isPercent?: boolean
  highlight?: boolean
}) {
  if (home === null && away === null) return null
  const h = home ?? 0
  const a = away ?? 0
  const total = h + a
  const homePct = total > 0 ? Math.round((h / total) * 100) : 50
  const awayPct = 100 - homePct

  const homeWins = h > a
  const awayWins = a > h

  return (
    <div className={`py-3 ${highlight ? 'opacity-100' : 'opacity-90'}`}>
      {/* Values + label */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-base font-black w-12 text-left ${homeWins ? 'text-white' : 'text-slate-400'}`}>
          {home !== null ? (isPercent ? `${h}%` : h) : '–'}
        </span>
        <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider text-center flex-1">{label}</span>
        <span className={`text-base font-black w-12 text-right ${awayWins ? 'text-white' : 'text-slate-400'}`}>
          {away !== null ? (isPercent ? `${a}%` : a) : '–'}
        </span>
      </div>

      {/* Bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
        <div
          className={`h-full rounded-l-full transition-all duration-500 ${homeWins ? 'bg-blue-500' : awayWins ? 'bg-white/20' : 'bg-white/20'}`}
          style={{ width: `${isPercent ? h : homePct}%` }}
        />
        <div
          className={`h-full rounded-r-full transition-all duration-500 ${awayWins ? 'bg-blue-500' : homeWins ? 'bg-white/20' : 'bg-white/20'}`}
          style={{ width: `${isPercent ? a : awayPct}%` }}
        />
      </div>
    </div>
  )
}

export default function MatchDetailModal({ fixtureId, onClose }: { fixtureId: number; onClose: () => void }) {
  const [data, setData] = useState<MatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'stats' | 'injuries' | 'h2h' | 'form'>('overview')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [onClose])

  useEffect(() => {
    fetch(`/api/fixtures/${fixtureId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [fixtureId])

  const kickoff = data ? new Date(data.fixture.date).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  }) : ''

  const isLive = data && ['1H', '2H', 'ET', 'HT'].includes(data.fixture.status)
  const isFinished = data?.fixture.status === 'FT'
  const hasMatchStats = !!(data?.statistics?.home && data?.statistics?.away)

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'stats', label: 'Stats' },
    { key: 'injuries', label: 'Injuries' },
    { key: 'h2h', label: 'Head to Head' },
    { key: 'form', label: 'Form' },
  ] as const

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full sm:max-w-2xl bg-[#060914] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-white/8 flex-shrink-0"
          style={{ background: 'linear-gradient(180deg, #0e1628 0%, #060914 100%)' }}>
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
            ✕
          </button>

          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-3 w-32 bg-white/10 rounded mx-auto" />
              <div className="h-8 w-48 bg-white/10 rounded mx-auto" />
            </div>
          ) : data ? (
            <>
              {/* League + round */}
              <div className="flex items-center justify-center gap-2 mb-4">
                {data.league.logo && <img src={data.league.logo} alt="" className="w-5 h-5 object-contain" />}
                <span className="text-xs text-slate-400 font-medium">{data.league.name} · {data.league.round}</span>
              </div>

              {/* Teams + Score */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 flex flex-col items-center gap-2">
                  <img src={data.home.logo} alt={data.home.name} className="w-14 h-14 object-contain" />
                  <span className="text-sm font-bold text-white text-center">{data.home.name}</span>
                </div>

                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  {(isLive || isFinished) && data.home.goals !== null ? (
                    <div className="flex items-center gap-3">
                      <span className="text-4xl font-black text-white">{data.home.goals}</span>
                      <span className="text-2xl text-slate-600">—</span>
                      <span className="text-4xl font-black text-white">{data.away.goals}</span>
                    </div>
                  ) : (
                    <span className="text-2xl font-black text-slate-400">vs</span>
                  )}
                  {isLive ? (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {data.fixture.status === 'HT' ? 'Half Time' : `${data.fixture.elapsed}'`}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">{kickoff}</span>
                  )}
                </div>

                <div className="flex-1 flex flex-col items-center gap-2">
                  <img src={data.away.logo} alt={data.away.name} className="w-14 h-14 object-contain" />
                  <span className="text-sm font-bold text-white text-center">{data.away.name}</span>
                </div>
              </div>

              {/* Venue */}
              {data.fixture.venue && (
                <div className="mt-3 text-center text-xs text-slate-500">
                  {data.fixture.venue}{data.fixture.city ? `, ${data.fixture.city}` : ''}
                  {data.fixture.referee ? ` · Ref: ${data.fixture.referee}` : ''}
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-slate-500">Failed to load match data</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/8 flex-shrink-0 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-shrink-0 flex-1 py-3 px-2 text-xs font-semibold transition-colors whitespace-nowrap
                ${tab === t.key ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />)}
            </div>
          )}

          {/* ── OVERVIEW ── */}
          {!loading && data && tab === 'overview' && (
            <div className="space-y-4">
              {/* AI Prediction */}
              {data.prediction && (
                <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4">
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">AI Prediction</div>
                  <div className="flex justify-between mb-3">
                    {[
                      { label: data.home.name, value: data.prediction.homeWinPercent },
                      { label: 'Draw', value: data.prediction.drawPercent },
                      { label: data.away.name, value: data.prediction.awayWinPercent },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col items-center gap-1">
                        <span className="text-xl font-black text-white">{value}</span>
                        <span className="text-[10px] text-slate-400 text-center">{label}</span>
                      </div>
                    ))}
                  </div>
                  {data.prediction.advice && (
                    <p className="text-xs text-slate-400 border-t border-white/8 pt-3">{data.prediction.advice}</p>
                  )}
                </div>
              )}

              {/* Quick injury count */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { team: data.home, label: 'Home Injuries' },
                  { team: data.away, label: 'Away Injuries' },
                ].map(({ team, label }) => (
                  <div key={label} className="rounded-xl border border-white/8 bg-white/3 p-3">
                    <div className="text-[10px] text-slate-500 mb-1">{label}</div>
                    <div className="flex items-center gap-2">
                      <img src={team.logo} alt={team.name} className="w-5 h-5 object-contain" />
                      <span className={`text-lg font-black ${team.injuries.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {team.injuries.length}
                      </span>
                      <span className="text-xs text-slate-500">players out</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Venue info */}
              {data.fixture.venue && (
                <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Venue</div>
                  <div className="text-sm font-semibold text-white">{data.fixture.venue}</div>
                  {data.fixture.city && <div className="text-xs text-slate-400">{data.fixture.city}</div>}
                  {data.fixture.referee && (
                    <div className="text-xs text-slate-500 mt-1">Referee: {data.fixture.referee}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STATS ── */}
          {!loading && data && tab === 'stats' && (
            <div>
              {/* Live / finished — show real match stats */}
              {(isLive || isFinished) && hasMatchStats ? (
                <div>
                  {/* Team headers */}
                  <div className="flex items-center justify-between mb-1 px-1">
                    <div className="flex items-center gap-2">
                      <img src={data.home.logo} alt={data.home.name} className="w-6 h-6 object-contain" />
                      <span className="text-xs font-bold text-white">{data.home.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{data.away.name}</span>
                      <img src={data.away.logo} alt={data.away.name} className="w-6 h-6 object-contain" />
                    </div>
                  </div>

                  <div className="divide-y divide-white/[0.04]">
                    <StatRow label="Ball Possession" home={data.statistics!.home.possession} away={data.statistics!.away.possession} isPercent />
                    <StatRow label="Total Shots" home={data.statistics!.home.shots_total} away={data.statistics!.away.shots_total} highlight />
                    <StatRow label="Shots on Goal" home={data.statistics!.home.shots_on_goal} away={data.statistics!.away.shots_on_goal} />
                    {(data.statistics!.home.xg !== null || data.statistics!.away.xg !== null) && (
                      <StatRow label="Expected Goals (xG)" home={data.statistics!.home.xg} away={data.statistics!.away.xg} />
                    )}
                    <StatRow label="Corner Kicks" home={data.statistics!.home.corners} away={data.statistics!.away.corners} />
                    <StatRow label="Fouls" home={data.statistics!.home.fouls} away={data.statistics!.away.fouls} />
                    <StatRow label="Yellow Cards" home={data.statistics!.home.yellow_cards} away={data.statistics!.away.yellow_cards} />
                    {(data.statistics!.home.red_cards !== null || data.statistics!.away.red_cards !== null) && (
                      <StatRow label="Red Cards" home={data.statistics!.home.red_cards} away={data.statistics!.away.red_cards} />
                    )}
                    <StatRow label="Goalkeeper Saves" home={data.statistics!.home.saves} away={data.statistics!.away.saves} />
                    <StatRow label="Offsides" home={data.statistics!.home.offsides} away={data.statistics!.away.offsides} />
                    <StatRow label="Total Passes" home={data.statistics!.home.passes_total} away={data.statistics!.away.passes_total} />
                    <StatRow label="Pass Accuracy" home={data.statistics!.home.pass_accuracy} away={data.statistics!.away.pass_accuracy} isPercent />
                  </div>
                </div>
              ) : (
                /* Pre-match — real season stats comparison */
                <div className="space-y-4">
                  {/* No data fallback */}
                  {!data.home_stats && !data.away_stats && (
                    <p className="text-xs text-slate-500 text-center py-6">Season statistics not available for this league</p>
                  )}

                  {data.home_stats && data.away_stats && (() => {
                    const hs = data.home_stats!
                    const as_ = data.away_stats!
                    return (
                      <>
                        {/* Team header strip */}
                        <div className="flex items-center justify-between px-1 mb-1">
                          <div className="flex items-center gap-2">
                            <img src={data.home.logo} alt={data.home.name} className="w-7 h-7 object-contain" />
                            <div>
                              <p className="text-xs font-bold text-white truncate max-w-[110px]">{data.home.name}</p>
                              {hs.top_formation && <p className="text-[10px] text-slate-500">{hs.top_formation}</p>}
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Season Stats</p>
                          <div className="flex items-center gap-2 justify-end">
                            <div className="text-right">
                              <p className="text-xs font-bold text-white truncate max-w-[110px]">{data.away.name}</p>
                              {as_.top_formation && <p className="text-[10px] text-slate-500">{as_.top_formation}</p>}
                            </div>
                            <img src={data.away.logo} alt={data.away.name} className="w-7 h-7 object-contain" />
                          </div>
                        </div>

                        {/* Season record */}
                        <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
                          <div className="text-center">
                            <p className="text-white font-black text-lg leading-none">{hs.wins}W {hs.draws}D {hs.losses}L</p>
                            <p className="text-slate-500 text-[10px] mt-0.5">{hs.played} played</p>
                          </div>
                          <p className="text-slate-600 text-xs">vs</p>
                          <div className="text-center">
                            <p className="text-white font-black text-lg leading-none">{as_.wins}W {as_.draws}D {as_.losses}L</p>
                            <p className="text-slate-500 text-[10px] mt-0.5">{as_.played} played</p>
                          </div>
                        </div>

                        {/* Stat rows */}
                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 divide-y divide-white/[0.04]">
                          <StatRow label="Win Rate" home={hs.win_rate} away={as_.win_rate} isPercent />
                          <StatRow label="Goals Scored / Game" home={hs.goals_for_avg} away={as_.goals_for_avg} highlight />
                          <StatRow label="Goals Conceded / Game" home={hs.goals_against_avg} away={as_.goals_against_avg} />
                          <StatRow label="Clean Sheet %" home={hs.clean_sheet_pct} away={as_.clean_sheet_pct} isPercent />
                          <StatRow label="Failed to Score %" home={hs.failed_to_score_pct} away={as_.failed_to_score_pct} isPercent />
                          <StatRow label="Yellow Cards / Game" home={hs.yellow_cards_avg} away={as_.yellow_cards_avg} />
                          <StatRow label="Red Cards (Total)" home={hs.red_cards_total} away={as_.red_cards_total} />
                          <StatRow label="Penalties Scored" home={hs.penalties_scored} away={as_.penalties_scored} />
                        </div>

                        {/* Home/Away splits */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Home record */}
                          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <img src={data.home.logo} alt="" className="w-4 h-4 object-contain" />
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Home Record</p>
                            </div>
                            <p className="text-white font-black text-sm">{hs.home.wins}W · {hs.home.draws}D · {hs.home.losses}L</p>
                            <p className="text-emerald-400 text-xs mt-1">{hs.home.goals_for} scored · {hs.home.goals_against} conceded</p>
                          </div>
                          {/* Away record */}
                          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <img src={data.away.logo} alt="" className="w-4 h-4 object-contain" />
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Away Record</p>
                            </div>
                            <p className="text-white font-black text-sm">{as_.away.wins}W · {as_.away.draws}D · {as_.away.losses}L</p>
                            <p className="text-emerald-400 text-xs mt-1">{as_.away.goals_for} scored · {as_.away.goals_against} conceded</p>
                          </div>
                        </div>

                        {/* Biggest results */}
                        {(hs.biggest_win || as_.biggest_win) && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                              <p className="text-[10px] text-slate-500 mb-1">Biggest Win</p>
                              <p className="text-emerald-400 font-black text-lg">{hs.biggest_win || '—'}</p>
                            </div>
                            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                              <p className="text-[10px] text-slate-500 mb-1">Biggest Win</p>
                              <p className="text-emerald-400 font-black text-lg">{as_.biggest_win || '—'}</p>
                            </div>
                          </div>
                        )}

                        {/* Note about live stats */}
                        <p className="text-[10px] text-slate-600 text-center">Live in-match stats (possession, shots, corners) appear once kick-off begins</p>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ── INJURIES ── */}
          {!loading && data && tab === 'injuries' && (
            <div className="space-y-5">
              {[{ team: data.home, injuries: data.home.injuries }, { team: data.away, injuries: data.away.injuries }].map(({ team, injuries }) => (
                <div key={team.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <img src={team.logo} alt={team.name} className="w-5 h-5 object-contain" />
                    <span className="text-sm font-bold text-white">{team.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${injuries.length === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {injuries.length === 0 ? 'All fit' : `${injuries.length} out`}
                    </span>
                  </div>
                  {injuries.length === 0 ? (
                    <p className="text-xs text-slate-600 pl-2">No injury concerns reported</p>
                  ) : (
                    <div className="space-y-2">
                      {injuries.map((inj, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/5">
                          {inj.photo && <img src={inj.photo} alt={inj.player} className="w-8 h-8 rounded-full object-cover bg-slate-800" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{inj.player}</div>
                            <div className="text-xs text-slate-400">{inj.reason || 'Injury'}</div>
                          </div>
                          <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0
                            ${inj.type === 'Questionable' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                            {inj.type === 'Questionable' ? 'Doubt' : 'Out'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── H2H ── */}
          {!loading && data && tab === 'h2h' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500 mb-4">Last {data.h2h.length} meetings</div>
              {data.h2h.length === 0 ? (
                <p className="text-sm text-slate-600 text-center py-4">No head-to-head data available</p>
              ) : data.h2h.map((match, i) => {
                const date = new Date(match.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                const homeWon = match.winner === match.homeTeam
                const awayWon = match.winner === match.awayTeam
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/5">
                    <span className="text-[10px] text-slate-600 w-20 flex-shrink-0">{date}</span>
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <span className={`text-xs font-semibold truncate ${homeWon ? 'text-white' : 'text-slate-500'}`}>
                        {match.homeTeam}
                      </span>
                      <span className="text-sm font-black text-white flex-shrink-0 px-2">
                        {match.homeGoals} – {match.awayGoals}
                      </span>
                      <span className={`text-xs font-semibold truncate text-right ${awayWon ? 'text-white' : 'text-slate-500'}`}>
                        {match.awayTeam}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── FORM ── */}
          {!loading && data && tab === 'form' && (
            <div className="space-y-6">
              {[{ team: data.home, form: data.home.form }, { team: data.away, form: data.away.form }].map(({ team, form }) => (
                <div key={team.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <img src={team.logo} alt={team.name} className="w-5 h-5 object-contain" />
                    <span className="text-sm font-bold text-white">{team.name}</span>
                    <div className="flex gap-1 ml-2">
                      {form.map((m, i) => <FormDot key={i} result={m.result} />)}
                    </div>
                  </div>
                  {form.length === 0 ? (
                    <p className="text-xs text-slate-600 pl-2">No recent form data</p>
                  ) : (
                    <div className="space-y-2">
                      {form.map((m, i) => {
                        const date = new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        return (
                          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3 border border-white/5">
                            <FormDot result={m.result} />
                            <span className="text-xs text-slate-400 w-14 flex-shrink-0">{date}</span>
                            <span className="text-xs text-slate-300 flex-1 truncate">
                              {m.isHome ? 'vs' : '@'} {m.opponent}
                            </span>
                            <span className="text-xs font-bold text-white">{m.score}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
