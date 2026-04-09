import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: "Today's AI Football Value Bets — Free Picks with EV Analysis",
  description: "Free AI football value bets updated daily. Every pick shows Expected Value vs bookmaker odds. Transparent track record — all predictions logged before kickoff. No sign-up needed.",
  keywords: ['football value bets today', 'free football tips', 'AI football predictions', 'expected value betting', 'best football bets today', 'football EV tips'],
  openGraph: {
    title: "Today's AI Football Value Bets — Free Picks",
    description: "Free AI football value bets with EV analysis. Predictions updated daily across Premier League, La Liga, Bundesliga, Serie A and more.",
  },
}

async function getTodaysPicks() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.company'}/api/public/predictions`,
      { next: { revalidate: 1800 } }
    )
    if (!res.ok) throw new Error()
    const data = await res.json()
    return (data.predictions ?? []).filter((p: any) => p.ev_percent >= 15)
  } catch {
    return []
  }
}

// Sample picks shown when DB is empty / first run
const SAMPLE_PICKS = [
  { home_team: 'Arsenal', away_team: 'Wolves', league: 'Premier League', bet_type: 'Home Win', odds: 1.52, ev_percent: 17.4, ai_probability: 74 },
  { home_team: 'Barcelona', away_team: 'Getafe', league: 'La Liga', bet_type: 'BTTS — Yes', odds: 1.68, ev_percent: 19.1, ai_probability: 71 },
  { home_team: 'PSG', away_team: 'Lyon', league: 'Ligue 1', bet_type: 'Over 2.5 Goals', odds: 1.82, ev_percent: 22.3, ai_probability: 73 },
  { home_team: 'Bayern Munich', away_team: 'Stuttgart', league: 'Bundesliga', bet_type: 'Home Win', odds: 1.45, ev_percent: 16.8, ai_probability: 78 },
  { home_team: 'Juventus', away_team: 'Roma', league: 'Serie A', bet_type: 'Under 2.5 Goals', odds: 1.78, ev_percent: 15.9, ai_probability: 70 },
]

export default async function ValueBetsPage() {
  const picks = await getTodaysPicks()
  const displayPicks = picks.length >= 3 ? picks : SAMPLE_PICKS
  const isDemo = picks.length < 3

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-[#0B0B14] text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B14]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg">M</div>
            <span className="text-white font-bold text-xl">Match<span className="text-violet-400">Mind</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-white/50 hover:text-white text-sm transition-colors px-4 py-2">Sign In</Link>
            <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-28 pb-20 px-4 max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse inline-block" />
            <span className="text-violet-300 text-sm font-medium">Updated daily by AI · Free, no sign-up needed</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-4">
            Today&apos;s AI Football{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Value Bets</span>
          </h1>
          <p className="text-white/40 text-lg max-w-2xl mx-auto mb-2">
            Every pick is selected because the bookmaker odds underestimate the true probability — giving you a statistical edge over time.
          </p>
          <p className="text-white/25 text-sm">{today}</p>
        </div>

        {/* What is EV — brief explainer */}
        <div className="bg-violet-600/8 border border-violet-500/20 rounded-2xl p-5 mb-8 flex items-start gap-4">
          <div className="text-2xl shrink-0">💡</div>
          <div>
            <p className="text-violet-300 font-semibold text-sm mb-1">What does EV% mean?</p>
            <p className="text-white/50 text-sm leading-relaxed">
              Expected Value (EV) measures how much profit you&apos;d make per £1 wagered over thousands of bets.
              A pick with +20% EV means on average you&apos;d profit 20p per £1 staked — the bookmaker has mispriced this outcome.
              <strong className="text-white/70"> Positive EV doesn&apos;t guarantee a single win</strong>, but it guarantees profitability over time.
            </p>
          </div>
        </div>

        {isDemo && (
          <div className="mb-6 bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3 text-sm">
            <span className="text-xl">📊</span>
            <p className="text-amber-300">Sample picks shown — real AI picks generate each morning. <Link href="/signup" className="text-amber-200 underline">Sign up free</Link> to get live picks emailed to you daily.</p>
          </div>
        )}

        {/* Picks */}
        <div className="space-y-4 mb-10">
          {displayPicks.slice(0, 5).map((pick: any, i: number) => (
            <div key={i} className="bg-[#13131F] border border-white/8 hover:border-violet-500/30 rounded-2xl p-5 transition-all">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-white font-bold">{pick.home_team} vs {pick.away_team}</h3>
                    <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{pick.league}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="bg-violet-600/20 text-violet-300 text-xs font-semibold px-3 py-1 rounded-lg border border-violet-500/25">{pick.bet_type}</span>
                    <span className="text-white font-bold">@ {Number(pick.odds).toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center">
                    <p className="text-emerald-400 font-black text-xl">+{Number(pick.ev_percent).toFixed(0)}%</p>
                    <p className="text-white/30 text-[10px] uppercase tracking-wide">EV</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold text-lg">{pick.ai_probability}%</p>
                    <p className="text-white/30 text-[10px] uppercase tracking-wide">AI prob.</p>
                  </div>
                </div>
              </div>

              {/* EV bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white/30 text-xs">AI probability vs implied bookmaker probability</span>
                  <span className="text-emerald-400 text-xs font-semibold">Edge: +{Number(pick.ev_percent).toFixed(0)}%</span>
                </div>
                <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                  {/* Implied odds line */}
                  <div
                    className="absolute top-0 left-0 h-full bg-white/15 rounded-full"
                    style={{ width: `${Math.round(100 / Number(pick.odds))}%` }}
                  />
                  {/* AI probability */}
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full"
                    style={{ width: `${pick.ai_probability}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-b from-violet-600/10 to-indigo-600/5 border border-violet-500/20 rounded-2xl p-8 text-center">
          <h2 className="text-white font-black text-2xl mb-3">Get picks emailed every morning</h2>
          <p className="text-white/40 mb-6 max-w-lg mx-auto">
            Sign up free and get today&apos;s AI value bets in your inbox at 9 AM. Plus: track your bets, chat with the AI coach, and see your personal ROI.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-violet-500/25">
              Start Free — No Card Needed →
            </Link>
            <Link href="/track-record" className="bg-white/5 hover:bg-white/8 border border-white/10 text-white/70 hover:text-white font-semibold px-6 py-3.5 rounded-xl transition-all text-sm">
              View Our Track Record
            </Link>
          </div>
        </div>

        {/* FAQ schema-friendly content for SEO */}
        <div className="mt-14 space-y-6">
          <h2 className="text-2xl font-black text-white">Frequently Asked Questions</h2>
          {[
            {
              q: 'How does MatchMind find value bets?',
              a: 'MatchMind\'s AI analyses team form, injuries, head-to-head records, and market odds across 15 leagues. It calculates the true probability of each outcome and flags bets where the bookmaker odds imply a lower probability than the AI estimates — these are called value bets.',
            },
            {
              q: 'What is Expected Value (EV) in betting?',
              a: 'Expected Value is the theoretical profit per unit staked over a large number of bets. A bet with +20% EV means that if you placed it 100 times, you\'d expect to profit £20 per £1 staked. Individual bets can still lose — EV is a long-run measure of quality.',
            },
            {
              q: 'Are these football tips guaranteed to win?',
              a: 'No tip service can guarantee wins. MatchMind\'s AI identifies statistical edges using Expected Value — bets that are priced better than their true probability. Over a large sample, positive EV bets should be profitable, but variance means short-term losing runs are normal.',
            },
            {
              q: 'Which football leagues does MatchMind cover?',
              a: 'MatchMind currently covers Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, Europa League, Championship, Turkish Süper Lig, and more — 15 leagues in total.',
            },
          ].map((item, i) => (
            <div key={i} className="border-b border-white/5 pb-5">
              <h3 className="text-white font-semibold mb-2">{item.q}</h3>
              <p className="text-white/45 text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>

        <p className="text-white/15 text-xs text-center mt-10">
          18+ only. Gambling involves risk. MatchMind picks are for entertainment and educational purposes — not financial advice. Please bet responsibly. <a href="https://www.begambleaware.org" className="underline" target="_blank" rel="noopener noreferrer">BeGambleAware.org</a>
        </p>
      </div>
    </div>
  )
}
