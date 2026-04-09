import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: "Today's AI Football Predictions — Free Match Tips | MatchMind",
  description: "Free AI-generated football match predictions with EV analysis. MatchMind analyses 15 leagues daily — see today's picks before kickoff.",
  openGraph: {
    title: "Today's AI Football Predictions — MatchMind",
    description: "AI-powered match predictions across Premier League, La Liga, Champions League and more. Free, updated daily.",
  },
}

export const revalidate = 300

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function slugify(str: string) {
  return str.toLowerCase()
    .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

function makeSlug(home: string, away: string, kickOff: string) {
  const date = new Date(kickOff)
  const day = date.getDate()
  const month = date.toLocaleString('en-US', { month: 'long' }).toLowerCase()
  const year = date.getFullYear()
  return `${slugify(home)}-vs-${slugify(away)}-${day}-${month}-${year}`
}

async function getPredictions() {
  try {
    const from = new Date()
    from.setDate(from.getDate() - 1)
    const to = new Date()
    to.setDate(to.getDate() + 4)

    const { data } = await supabaseAdmin
      .from('prediction_records')
      .select('id, home_team, away_team, league, kick_off, bet_type, odds, ev_percent, is_value_bet, result')
      .gte('kick_off', from.toISOString())
      .lte('kick_off', to.toISOString())
      .order('kick_off', { ascending: true })

    // Deduplicate by fixture (show one card per match, the best pick)
    const fixtures: Record<string, typeof data[0]> = {}
    for (const row of (data || [])) {
      const key = `${row.home_team}|${row.away_team}|${row.kick_off?.slice(0, 10)}`
      if (!fixtures[key] || (row.ev_percent ?? 0) > (fixtures[key].ev_percent ?? 0)) {
        fixtures[key] = row
      }
    }
    return Object.values(fixtures)
  } catch {
    return []
  }
}

export default async function PredictionsIndexPage() {
  const matches = await getPredictions()

  const today = new Date().toDateString()
  const todayMatches = matches.filter(m => m.kick_off && new Date(m.kick_off).toDateString() === today)
  const upcomingMatches = matches.filter(m => m.kick_off && new Date(m.kick_off).toDateString() !== today)

  return (
    <div className="min-h-screen bg-[#0B0B14] text-white">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B14]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm">M</div>
            <span className="text-white font-bold text-lg tracking-tight">Match<span className="text-violet-400">Mind</span></span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/value-bets" className="text-white/50 hover:text-white transition-colors">Value Bets</Link>
            <Link href="/track-record" className="text-white/50 hover:text-white transition-colors">Track Record</Link>
            <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-4 py-2 rounded-xl transition-colors">Start Free</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 pt-24 pb-16">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-violet-300 text-xs font-medium mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            AI-generated · Updated daily
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
            AI Football Match Predictions
          </h1>
          <p className="text-white/50 max-w-xl mx-auto">
            Every pick is selected using Expected Value analysis across 15 leagues.
            Predictions logged before kickoff and auto-verified against results.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { label: 'Matches analysed', value: matches.length.toString(), icon: '⚽' },
            { label: 'Value bets today', value: todayMatches.filter(m => m.is_value_bet).length.toString(), icon: '🔥' },
            { label: 'Leagues covered', value: '15', icon: '🏆' },
          ].map(s => (
            <div key={s.label} className="bg-[#13162b] border border-white/8 rounded-2xl p-4 text-center">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-white font-black text-xl">{s.value}</p>
              <p className="text-white/40 text-xs">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Today's picks */}
        {todayMatches.length > 0 && (
          <section className="mb-8">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Today's Matches
            </h2>
            <MatchGrid matches={todayMatches} />
          </section>
        )}

        {/* Upcoming */}
        {upcomingMatches.length > 0 && (
          <section className="mb-10">
            <h2 className="text-white font-bold text-lg mb-4">Upcoming Matches</h2>
            <MatchGrid matches={upcomingMatches} />
          </section>
        )}

        {matches.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">⚽</p>
            <p className="text-white font-bold mb-2">Predictions loading</p>
            <p className="text-white/40 text-sm">New picks are generated daily at 8 AM GMT</p>
          </div>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-r from-violet-600/15 to-indigo-600/15 border border-violet-500/25 rounded-2xl p-8 text-center mt-8">
          <p className="text-white font-bold text-lg mb-2">Track these bets & get daily alerts</p>
          <p className="text-white/50 text-sm mb-5">Sign up free — log your bets, get AI coaching, and receive value bets in your inbox at 9 AM.</p>
          <Link
            href="/signup"
            className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-3 rounded-xl transition-colors"
          >
            Start Free — No Card Needed →
          </Link>
        </div>
      </div>
    </div>
  )
}

function MatchGrid({ matches }: { matches: Awaited<ReturnType<typeof getPredictions>> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {matches.map(m => {
        const slug = makeSlug(m.home_team, m.away_team, m.kick_off!)
        const kickOff = m.kick_off ? new Date(m.kick_off) : null
        const settled = m.result !== null
        return (
          <Link
            key={m.id}
            href={`/predictions/${slug}`}
            className="group bg-[#13162b] hover:bg-[#1a1d35] border border-white/8 hover:border-violet-500/30 rounded-2xl p-4 transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="text-white font-bold text-sm group-hover:text-violet-300 transition-colors">
                  {m.home_team} vs {m.away_team}
                </p>
                <p className="text-white/35 text-xs mt-0.5">{m.league}</p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                {m.is_value_bet && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">🔥 Value</span>
                )}
                {settled && m.result === 'win' && <span className="text-[10px] font-bold text-emerald-400">✅ Won</span>}
                {settled && m.result === 'loss' && <span className="text-[10px] font-bold text-red-400">❌ Lost</span>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-violet-600/15 text-violet-300 text-xs font-semibold px-2.5 py-1 rounded-lg border border-violet-500/20">{m.bet_type}</span>
              {m.odds && <span className="text-white/60 text-xs">@ {m.odds.toFixed(2)}</span>}
              {m.ev_percent && <span className="text-emerald-400 text-xs font-bold">+{m.ev_percent}% EV</span>}
              {kickOff && (
                <span className="text-white/25 text-xs ml-auto">
                  {kickOff.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
