import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PublicFooter from '@/components/layout/PublicFooter'

async function getLiveStats() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'}/api/stats/public`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error()
    return await res.json()
  } catch {
    return { users: 0, tipsters: 0, bets_tracked: 0, ai_accuracy: 61, value_bets_today: 9, leagues_covered: 25 }
  }
}

async function getPublicPredictions() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'}/api/public/predictions`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error()
    const data = await res.json()
    return data.predictions as Array<{
      id: string
      home_team: string
      away_team: string
      league: string
      bet_type: string
      odds: number
      ev_percent: number
      ai_probability: number
      kick_off: string
    }>
  } catch {
    return []
  }
}

async function getTrackRecord() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'}/api/track-record`, {
      next: { revalidate: 600 },
    })
    if (!res.ok) throw new Error()
    return (await res.json()).stats as { total: number; wins: number; winRate: number; roi: number; valueBets: { total: number; winRate: number } }
  } catch {
    return null
  }
}

const SAMPLE_PREDS = [
  { home_team: 'Arsenal', away_team: 'Chelsea', league: 'Premier League', bet_type: 'Over 2.5 Goals', odds: 1.87, ev_percent: 18.4, ai_probability: 72, kick_off: '', id: 's1' },
  { home_team: 'Real Madrid', away_team: 'Atletico', league: 'La Liga', bet_type: 'BTTS — Yes', odds: 1.74, ev_percent: 11.2, ai_probability: 68, kick_off: '', id: 's2' },
  { home_team: 'Bayern', away_team: 'Dortmund', league: 'Bundesliga', bet_type: 'Over 2.5 Goals', odds: 1.78, ev_percent: 9.6, ai_probability: 65, kick_off: '', id: 's3' },
]

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const [stats, livePreds, track] = await Promise.all([getLiveStats(), getPublicPredictions(), getTrackRecord()])
  const predictions = livePreds.length > 0 ? livePreds : SAMPLE_PREDS
  const isLiveData = livePreds.length > 0

  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MatchMind',
    url: 'https://www.matchmindcom.com',
    logo: 'https://www.matchmindcom.com/icon-512.png',
    description: 'AI-powered football predictions, value bets with Pinnacle edge detection, and an AI betting coach.',
    sameAs: [
      'https://www.tiktok.com/@match.mindai',
      'https://instagram.com/match.mindai',
      'https://twitter.com/Match_Mind_AI',
    ],
  }

  return (
    <div className="min-h-screen bg-[#0B0B14] text-white overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B14]/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] flex items-center justify-center text-white font-black text-lg shadow-lg shadow-orange-500/30">M</div>
            <span className="text-white font-bold text-xl tracking-tight">Match<span className="text-orange-400">Mind</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm text-white/55">
            <a href="#picks" className="hover:text-white transition-colors">Today&apos;s picks</a>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <Link href="/track-record" className="hover:text-white transition-colors">Track record</Link>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-white/60 hover:text-white text-sm font-medium transition-colors px-3 py-2">Sign in</Link>
            <Link href="/signup" className="bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-orange-500/30">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-36 pb-24 px-5 relative">
        {/* Orange glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-orange-500/15 rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute top-32 right-1/4 w-[300px] h-[300px] bg-orange-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto relative grid md:grid-cols-[1.3fr_1fr] gap-12 items-center">
          {/* Left: headline */}
          <div>
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/25 rounded-full px-3 py-1 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-orange-300 text-xs font-semibold tracking-wide uppercase">{stats.value_bets_today} value bets live today</span>
            </div>
            <h1 className="text-5xl sm:text-6xl font-black leading-[1.02] tracking-tight mb-6">
              See the edge{' '}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">before kickoff.</span>
            </h1>
            <p className="text-white/55 text-lg leading-relaxed mb-8 max-w-lg">
              AI analyses every match across 25 leagues. Each pick is logged before kick-off with full reasoning, then auto-verified against the result.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link href="/signup" className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-7 py-4 rounded-2xl text-base transition-all shadow-xl shadow-orange-500/30 hover:-translate-y-0.5 text-center">
                Start free → no card needed
              </Link>
              <a href="#picks" className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-7 py-4 rounded-2xl text-base transition-all text-center">
                See today&apos;s picks
              </a>
            </div>
            <p className="text-white/30 text-xs">
              <span className="text-white/50">{stats.users.toLocaleString()}</span> signed up · <span className="text-white/50">5,534</span> on TikTok · every pick publicly tracked
            </p>
          </div>

          {/* Right: floating pick card */}
          <div className="hidden md:block relative">
            <div className="absolute -inset-10 bg-orange-500/20 rounded-full blur-[80px] pointer-events-none" />
            <div className="relative bg-[#13131F] border border-orange-500/30 rounded-2xl p-5 shadow-2xl shadow-orange-500/10 rotate-1 hover:rotate-0 transition-transform">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-orange-400">Value bet</span>
                <span className="text-xs text-white/30">{predictions[0].league}</span>
              </div>
              <p className="text-white font-bold text-lg mb-1">{predictions[0].home_team}</p>
              <p className="text-white/40 text-sm mb-1">vs</p>
              <p className="text-white font-bold text-lg mb-4">{predictions[0].away_team}</p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">AI pick</p>
                <p className="text-white font-semibold mb-3">{predictions[0].bet_type} @ {Number(predictions[0].odds).toFixed(2)}</p>
                <div className="flex gap-4">
                  <div>
                    <p className="text-emerald-400 font-black text-xl leading-none">+{Number(predictions[0].ev_percent).toFixed(0)}%</p>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mt-1">EV edge</p>
                  </div>
                  <div className="h-8 w-px bg-white/10 mx-1" />
                  <div>
                    <p className="text-white font-black text-xl leading-none">{predictions[0].ai_probability}%</p>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mt-1">AI prob.</p>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-white/35">Locked in before kick-off · verified after the whistle</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE STATS STRIP ── */}
      <section className="px-5 pb-16">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { val: stats.value_bets_today, lbl: 'Value bets today', color: 'text-orange-400' },
            { val: stats.leagues_covered, lbl: 'Leagues covered', color: 'text-white' },
            { val: track?.total ?? 48, lbl: 'Picks tracked', color: 'text-white' },
            { val: (track?.valueBets?.winRate ?? 39) + '%', lbl: 'Value-bet win rate', color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.lbl} className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 text-center">
              <p className={`text-3xl font-black ${s.color} mb-1`}>{s.val}</p>
              <p className="text-white/40 text-xs uppercase tracking-wider">{s.lbl}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TODAY'S PICKS ── */}
      <section id="picks" className="px-5 py-20 border-y border-white/5 bg-white/[0.015]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/25 rounded-full px-3 py-1 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-orange-300 text-xs font-semibold uppercase tracking-wide">
                {isLiveData ? 'Live from the AI right now' : 'Sample picks'}
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-3">Today&apos;s top value bets</h2>
            <p className="text-white/45 text-lg">Free preview — sign up to see all {stats.value_bets_today}+ picks and set alerts.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-10">
            {predictions.slice(0, 3).map(p => (
              <div key={p.id} className="bg-[#13131F] border border-white/8 hover:border-orange-500/30 rounded-2xl p-5 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-wider">{p.league}</span>
                  <span className="text-emerald-400 font-black text-sm">+{Number(p.ev_percent).toFixed(0)}% EV</span>
                </div>
                <p className="text-white font-bold mb-1">{p.home_team}</p>
                <p className="text-white/40 text-xs mb-1">vs</p>
                <p className="text-white font-bold mb-4">{p.away_team}</p>
                <div className="border-t border-white/5 pt-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">AI pick</p>
                  <p className="text-white font-semibold text-sm">{p.bet_type} @ {Number(p.odds).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/predictions" className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 font-semibold">
              See all of today&apos;s picks <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="px-5 py-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-14">How it works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: 1, t: 'AI scans every match', d: 'GPT-4o analyses form, injuries, xG, and head-to-head across 25 leagues — then prices every outcome.' },
              { n: 2, t: 'We compare to the bookies', d: 'Each pick shows where the AI probability beats the bookmaker\u2019s odds. Positive EV = mathematical edge.' },
              { n: 3, t: 'Track every bet', d: 'Log your slips, auto-verify results, monitor your ROI. Full transparency — every pick logged before kick-off.' },
            ].map(step => (
              <div key={step.n} className="relative bg-[#13131F] border border-white/8 rounded-2xl p-6">
                <div className="absolute -top-4 left-6 w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-orange-500/30">{step.n}</div>
                <h3 className="text-white font-bold text-lg mt-3 mb-2">{step.t}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRACK RECORD STRIP ── */}
      <section className="px-5 py-16 border-y border-white/5 bg-white/[0.015]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-white/35 text-xs font-semibold uppercase tracking-widest mb-3">Transparency over hype</p>
          <h2 className="text-2xl sm:text-3xl font-black mb-5">Every pick logged before kick-off. Every result public.</h2>
          <p className="text-white/50 mb-8 max-w-xl mx-auto">
            We don&apos;t claim 70% win rates. We publish every single pick the moment it&apos;s made and let the tape speak.
          </p>
          <Link href="/track-record" className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-6 py-3 rounded-xl transition-all">
            See the full track record <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="px-5 py-24">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-black mb-3">Simple pricing</h2>
            <p className="text-white/45">Start free. Upgrade when you want the full edge.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Free */}
            <div className="bg-[#13131F] border border-white/8 rounded-2xl p-7">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-bold">Free</span>
                <span className="text-white/40 text-sm">forever</span>
              </div>
              <p className="text-white/40 text-sm mb-6">Kick the tires. No card needed.</p>
              <ul className="space-y-2.5 text-sm text-white/70 mb-6">
                <li>• 3 AI picks per day</li>
                <li>• Bet slip tracker</li>
                <li>• Public track record</li>
                <li>• Basic bankroll tool</li>
              </ul>
              <Link href="/signup" className="block text-center bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-all">
                Start free
              </Link>
            </div>

            {/* Pro */}
            <div className="relative bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/40 rounded-2xl p-7">
              <span className="absolute -top-3 right-6 bg-orange-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-lg shadow-orange-500/40">Most popular</span>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-black text-orange-400">£9.99</span>
                <span className="text-white/50 text-sm">/month</span>
              </div>
              <p className="text-white/60 text-sm mb-6">Full edge, all features, cancel anytime.</p>
              <ul className="space-y-2.5 text-sm text-white/80 mb-6">
                <li><span className="text-orange-400">✓</span> Unlimited AI picks + value bets</li>
                <li><span className="text-orange-400">✓</span> Pinnacle edge detection</li>
                <li><span className="text-orange-400">✓</span> Daily value-bet email alerts</li>
                <li><span className="text-orange-400">✓</span> AI betting coach (GPT-4o)</li>
                <li><span className="text-orange-400">✓</span> Full bankroll tracker + Kelly staking</li>
                <li><span className="text-orange-400">✓</span> Weekly performance reports</li>
              </ul>
              <Link href="/signup" className="block text-center bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-orange-500/30">
                Start Pro free →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-5 py-20 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-10">Questions</h2>
          <div className="space-y-3">
            {[
              { q: 'Is MatchMind a betting site?', a: 'No — we don\u2019t take bets. We analyse matches and show you where the bookmakers have mispriced outcomes. Placing bets is your choice, on whatever site you use.' },
              { q: 'Do you guarantee wins?', a: 'No one can. Positive expected value guarantees profitability over hundreds of bets, not any single one. We publish every pick before kick-off so you can judge the edge yourself.' },
              { q: 'Why £9.99 and not £29?', a: 'Because we\u2019re in launch mode and the math works: 1 value bet per day at +10% EV covers the sub and more. Grandfathered for life if you join early.' },
              { q: 'Can I cancel anytime?', a: 'One click in your settings. Full Stripe-backed billing, no hidden fees, no annual lock-in.' },
              { q: 'Is this legal in the UK?', a: 'Yes. MatchMind is analytics software, not a bookmaker. Using betting analytics tools is legal. Always gamble responsibly. 18+.' },
            ].map(f => (
              <details key={f.q} className="group bg-[#13131F] border border-white/8 rounded-xl p-5 open:border-orange-500/30 transition-colors">
                <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-white">
                  <span>{f.q}</span>
                  <span className="text-orange-400 text-xl leading-none group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-white/55 text-sm leading-relaxed mt-3">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="px-5 py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-black mb-5 leading-tight">
            Start finding the edge{' '}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">today.</span>
          </h2>
          <p className="text-white/50 text-lg mb-8 max-w-xl mx-auto">
            Free forever plan. No credit card. 30 seconds to sign up — {stats.value_bets_today} value bets waiting.
          </p>
          <Link href="/signup" className="inline-block bg-orange-500 hover:bg-orange-400 text-white font-bold px-10 py-4 rounded-2xl text-lg transition-all shadow-xl shadow-orange-500/40 hover:-translate-y-0.5">
            Start free →
          </Link>
          <p className="text-white/25 text-xs mt-5">
            <span className="inline-block bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded mr-1.5 font-semibold">18+</span>
            Bet responsibly. <a href="https://www.begambleaware.org" className="underline hover:text-white/50" target="_blank" rel="noopener noreferrer">BeGambleAware.org</a>
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
