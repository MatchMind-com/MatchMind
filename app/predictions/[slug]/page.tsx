import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient as createAdmin } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.company'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const revalidate = 300

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

async function getMatchData(slug: string) {
  try {
    const from = new Date()
    from.setDate(from.getDate() - 7)
    const to = new Date()
    to.setDate(to.getDate() + 7)

    const { data } = await supabaseAdmin
      .from('prediction_records')
      .select('id, home_team, away_team, league, kick_off, bet_type, prediction, ai_probability, odds, ev_percent, is_value_bet, result, home_score, away_score, key_factors, home_win_pct, draw_pct, away_win_pct')
      .gte('kick_off', from.toISOString())
      .lte('kick_off', to.toISOString())

    if (!data) return null
    const matching = data.filter(r => makeSlug(r.home_team, r.away_team, r.kick_off) === slug)
    if (matching.length === 0) return null

    const first = matching[0]
    return { match: first, picks: matching }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await getMatchData(params.slug)
  if (!data) {
    return { title: 'Match Prediction | MatchMind' }
  }
  const { match } = data
  const kickOff = new Date(match.kick_off)
  const dateStr = kickOff.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const title = `${match.home_team} vs ${match.away_team} Prediction ${dateStr} — AI Tips & Odds`
  const description = `MatchMind AI prediction for ${match.home_team} vs ${match.away_team} on ${dateStr}. ${match.league}. AI probability analysis, Expected Value picks, and best bet recommendation.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${APP_URL}/predictions/${params.slug}`,
      siteName: 'MatchMind',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

function ResultBadge({ result }: { result: string | null }) {
  if (!result) return <span className="text-xs text-white/30 px-2 py-0.5 rounded-full bg-white/5">Pending</span>
  if (result === 'win') return <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">✅ Won</span>
  if (result === 'loss') return <span className="text-xs font-bold text-red-400 bg-red-500/15 border border-red-500/20 px-2 py-0.5 rounded-full">❌ Lost</span>
  return <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">Void</span>
}

export default async function MatchPredictionPage({ params }: { params: { slug: string } }) {
  const data = await getMatchData(params.slug)
  if (!data) notFound()

  const { match, picks } = data
  const kickOff = new Date(match.kick_off)
  const isSettled = picks.some(p => p.result !== null)
  const bestPick = picks.sort((a, b) => (b.ev_percent ?? 0) - (a.ev_percent ?? 0))[0]

  const dateStr = kickOff.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const timeStr = kickOff.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="min-h-screen bg-[#0B0B14] text-white">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B14]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo-icon.png" alt="MatchMind" width={32} height={32} className="object-contain" />
            <span className="text-white font-bold text-lg tracking-tight">Match<span className="text-violet-400">Mind</span></span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/predictions" className="text-white/50 hover:text-white transition-colors">All Predictions</Link>
            <Link href="/track-record" className="text-white/50 hover:text-white transition-colors">Track Record</Link>
            <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-4 py-2 rounded-xl transition-colors">Start Free</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-white/30 text-xs mb-6">
          <Link href="/predictions" className="hover:text-white/60 transition-colors">AI Predictions</Link>
          <span>/</span>
          <span className="text-white/50">{match.home_team} vs {match.away_team}</span>
        </div>

        {/* Match header */}
        <div className="bg-[#13162b] border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-white/40 text-xs bg-white/5 px-2.5 py-1 rounded-full">{match.league}</span>
            {isSettled && match.home_score !== null && (
              <span className="text-white/60 text-sm font-bold">
                Final: {match.home_score} – {match.away_score}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 items-center gap-4 text-center mb-4">
            <div>
              <p className="text-white font-black text-xl md:text-2xl">{match.home_team}</p>
              <p className="text-white/40 text-xs mt-1">Home</p>
            </div>
            <div>
              <p className="text-white/30 text-lg font-bold">vs</p>
              <p className="text-white/25 text-xs mt-1">{dateStr}</p>
              <p className="text-violet-400 text-xs font-semibold">{timeStr} GMT</p>
            </div>
            <div>
              <p className="text-white font-black text-xl md:text-2xl">{match.away_team}</p>
              <p className="text-white/40 text-xs mt-1">Away</p>
            </div>
          </div>

          {/* Probability bar */}
          {match.home_win_pct && match.draw_pct && match.away_win_pct && (
            <div>
              <div className="flex justify-between text-xs text-white/50 mb-1.5">
                <span>Home {match.home_win_pct}%</span>
                <span>Draw {match.draw_pct}%</span>
                <span>Away {match.away_win_pct}%</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                <div className="bg-violet-500 rounded-l-full" style={{ width: `${match.home_win_pct}%` }} />
                <div className="bg-white/20" style={{ width: `${match.draw_pct}%` }} />
                <div className="bg-indigo-500 rounded-r-full" style={{ width: `${match.away_win_pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* AI Picks */}
        <h2 className="text-white font-bold text-lg mb-4">
          AI Recommended Picks
          <span className="text-white/30 text-sm font-normal ml-2">({picks.length} {picks.length === 1 ? 'pick' : 'picks'})</span>
        </h2>

        <div className="space-y-3 mb-8">
          {picks.map(pick => (
            <div
              key={pick.id}
              className={`border rounded-2xl p-4 ${
                pick.result === 'win' ? 'bg-emerald-950/30 border-emerald-500/20'
                : pick.result === 'loss' ? 'bg-red-950/20 border-red-500/15'
                : 'bg-[#13162b] border-white/8'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-violet-600/20 text-violet-300 text-xs font-semibold px-2.5 py-1 rounded-lg border border-violet-500/20">{pick.bet_type}</span>
                    {pick.is_value_bet && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">🔥 Value Bet</span>
                    )}
                  </div>
                  <p className="text-white font-bold mt-2 text-lg capitalize">{pick.prediction?.replace(/_/g, ' ')}</p>
                </div>
                <ResultBadge result={pick.result} />
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                {pick.odds && (
                  <div>
                    <p className="text-white/40 text-[10px] uppercase tracking-wide">Bet365 Odds</p>
                    <p className="text-white font-bold">@ {pick.odds.toFixed(2)}</p>
                  </div>
                )}
                {pick.ai_probability && (
                  <div>
                    <p className="text-white/40 text-[10px] uppercase tracking-wide">AI Probability</p>
                    <p className="text-white font-bold">{pick.ai_probability}%</p>
                  </div>
                )}
                {pick.ev_percent && (
                  <div>
                    <p className="text-white/40 text-[10px] uppercase tracking-wide">Expected Value</p>
                    <p className={`font-bold ${pick.ev_percent >= 15 ? 'text-emerald-400' : 'text-white/70'}`}>+{pick.ev_percent}%</p>
                  </div>
                )}
              </div>

              {/* EV explainer */}
              {pick.ev_percent && pick.ev_percent >= 15 && (
                <div className="mt-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-3 py-2">
                  <p className="text-emerald-400/80 text-xs">
                    <span className="font-semibold">+{pick.ev_percent}% EV</span> — this pick is statistically worth £{(pick.ev_percent / 100).toFixed(2)} profit per £1 staked over many bets at these odds.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-[#13162b] border border-white/10 rounded-2xl p-6 text-center mb-8">
          <p className="text-white font-bold mb-1">Want to track this bet?</p>
          <p className="text-white/50 text-sm mb-4">Log your stake, get AI coaching, and see your ROI over time — free to start.</p>
          <Link
            href="/signup"
            className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-3 rounded-xl transition-colors"
          >
            Start Free — No Card Needed →
          </Link>
        </div>

        {/* Responsible gambling */}
        <p className="text-white/20 text-xs text-center">
          18+ only. Gambling involves risk. AI predictions are for educational purposes — not financial advice.{' '}
          <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/40">BeGambleAware.org</a>
        </p>
      </div>
    </div>
  )
}
