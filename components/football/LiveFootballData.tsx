'use client'
import { useState, useEffect } from 'react'

const LEAGUES = [
  { id: '39',  name: 'Premier League',      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: '140', name: 'La Liga',             flag: '🇪🇸' },
  { id: '135', name: 'Serie A',             flag: '🇮🇹' },
  { id: '78',  name: 'Bundesliga',          flag: '🇩🇪' },
  { id: '61',  name: 'Ligue 1',            flag: '🇫🇷' },
  { id: '2',   name: 'Champions League',    flag: '🏆' },
  { id: '3',   name: 'Europa League',       flag: '🥈' },
  { id: '848', name: 'Conference League',   flag: '🥉' },
  { id: '40',  name: 'Championship',        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: '88',  name: 'Eredivisie',          flag: '🇳🇱' },
  { id: '94',  name: 'Primeira Liga',       flag: '🇵🇹' },
  { id: '203', name: 'Süper Lig',          flag: '🇹🇷' },
  { id: '179', name: 'Scottish Prem',       flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { id: '144', name: 'Belgian Pro League',  flag: '🇧🇪' },
  { id: '253', name: 'MLS',                 flag: '🇺🇸' },
]

interface Fixture {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null } }
  teams: { home: { name: string; logo: string }; away: { name: string; logo: string } }
  goals: { home: number | null; away: number | null }
  league: { name: string }
}

export default function LiveFootballData({ onLeagueChange }: { onLeagueChange?: (id: string) => void }) {
  const [tab, setTab] = useState<'upcoming' | 'live' | 'results' | 'standings'>('upcoming')
  const [league, setLeague] = useState('39')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [tab, league])

  async function fetchData() {
    setLoading(true)
    try {
      const type = tab === 'upcoming' ? 'fixtures' : tab === 'live' ? 'live' : tab === 'results' ? 'results' : 'standings'
      const res = await fetch(`/api/football-data?type=${type}&league=${league}`)
      const json = await res.json()
      setData(json.data || [])
    } catch { setData([]) }
    setLoading(false)
  }

  function handleLeague(id: string) {
    setLeague(id)
    onLeagueChange?.(id)
  }

  return (
    <div className="bg-[#12121F] rounded-xl border border-white/10 overflow-hidden">
      {/* League selector */}
      <div className="flex gap-1 p-3 border-b border-white/10 overflow-x-auto">
        {LEAGUES.map(l => (
          <button
            key={l.id}
            onClick={() => handleLeague(l.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              league === l.id
                ? 'bg-violet-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>{l.flag}</span>
            <span className="hidden sm:inline">{l.name}</span>
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        {(['upcoming', 'live', 'results', 'standings'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
              tab === t
                ? 'text-violet-400 border-b-2 border-violet-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'live' ? '🔴 Live' : t === 'upcoming' ? '📅 Upcoming' : t === 'results' ? '✅ Results' : '📊 Table'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-6">
            {tab === 'live' ? 'No live games right now' : tab === 'results' ? 'No recent results' : 'No data available'}
          </p>
        ) : tab === 'standings' ? (
          <StandingsView data={data} />
        ) : tab === 'results' ? (
          <FixturesView data={data} isLive={false} isResult />
        ) : (
          <FixturesView data={data} isLive={tab === 'live'} />
        )}
      </div>
    </div>
  )
}

function FixturesView({ data, isLive, isResult }: { data: Fixture[]; isLive: boolean; isResult?: boolean }) {
  return (
    <>
      {data.map((f) => {
        const date = new Date(f.fixture.date)
        const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
        const isLiveNow = ['1H', '2H', 'ET', 'HT', 'P'].includes(f.fixture.status.short)

        return (
          <div key={f.fixture.id} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-white font-medium truncate">{f.teams.home.name}</span>
                {(isLive && isLiveNow) || isResult ? (
                  <span className={`text-sm font-bold px-2 ${isResult ? 'text-emerald-400' : 'text-white'}`}>
                    {f.goals.home ?? 0} - {f.goals.away ?? 0}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">vs</span>
                )}
                <span className="text-xs text-white font-medium truncate text-right">{f.teams.away.name}</span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-gray-500">{dateStr}</span>
                {isLive && isLiveNow && f.fixture.status.elapsed ? (
                  <span className="text-[10px] text-red-400 font-bold animate-pulse">{f.fixture.status.elapsed}'</span>
                ) : (
                  <span className="text-[10px] text-gray-500">{timeStr}</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

function StandingsView({ data }: { data: any[] }) {
  return (
    <table className="w-full text-[10px]">
      <thead>
        <tr className="text-gray-500 border-b border-white/10">
          <th className="text-left pb-1 font-medium">#</th>
          <th className="text-left pb-1 font-medium">Team</th>
          <th className="text-right pb-1 font-medium">P</th>
          <th className="text-right pb-1 font-medium">W</th>
          <th className="text-right pb-1 font-medium">D</th>
          <th className="text-right pb-1 font-medium">L</th>
          <th className="text-right pb-1 font-medium">Pts</th>
        </tr>
      </thead>
      <tbody>
        {data.map((t: any) => (
          <tr key={t.rank} className="border-b border-white/5 last:border-0">
            <td className="py-1 text-gray-400">{t.rank}</td>
            <td className="py-1 text-white font-medium truncate max-w-[100px]">{t.team?.name}</td>
            <td className="py-1 text-right text-gray-400">{t.all?.played}</td>
            <td className="py-1 text-right text-emerald-400">{t.all?.win}</td>
            <td className="py-1 text-right text-gray-400">{t.all?.draw}</td>
            <td className="py-1 text-right text-red-400">{t.all?.lose}</td>
            <td className="py-1 text-right text-violet-400 font-bold">{t.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
