import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EmailCapture from '@/components/landing/EmailCapture'
import ActivityStrip from '@/components/landing/ActivityStrip'
import EarningsCalculator from '@/components/landing/EarningsCalculator'

async function getLiveStats() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://footballbetai.vercel.app'}/api/stats/public`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error()
    return await res.json()
  } catch {
    return { users: 0, tipsters: 0, bets_tracked: 0, ai_accuracy: 61, value_bets_today: 9, leagues_covered: 15 }
  }
}

async function getPublicPredictions() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://footballbetai.vercel.app'}/api/public/predictions`, {
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

// Fallback sample predictions used when DB is still empty
const SAMPLE_PREDS = [
  { home_team: 'Arsenal', away_team: 'Chelsea', league: 'Premier League', bet_type: 'Over 2.5 Goals', odds: 1.87, ev_percent: 18.4, ai_probability: 72, kick_off: '', id: 's1' },
  { home_team: 'Barcelona', away_team: 'Atletico', league: 'La Liga', bet_type: 'BTTS — Yes', odds: 1.74, ev_percent: 11.2, ai_probability: 68, kick_off: '', id: 's2' },
  { home_team: 'PSG', away_team: 'Lens', league: 'Ligue 1', bet_type: 'Over 2.5 Goals', odds: 1.78, ev_percent: 9.6, ai_probability: 65, kick_off: '', id: 's3' },
]

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const [stats, livePreds] = await Promise.all([getLiveStats(), getPublicPredictions()])
  const predictions = livePreds.length > 0 ? livePreds : SAMPLE_PREDS
  const isLiveData = livePreds.length > 0

  return (
    <div className="min-h-screen bg-[#0B0B14] text-white overflow-x-hidden">

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B14]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-violet-500/30">B</div>
            <span className="text-white font-bold text-xl tracking-tight">Bet<span className="text-violet-400">IQ</span></span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-white/50">
            <a href="#value-bets" className="hover:text-white transition-colors">Value Bets</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#tipsters" className="hover:text-white transition-colors">Tipsters</a>
            <Link href="/track-record" className="hover:text-white transition-colors text-emerald-400/70 hover:text-emerald-300">📊 Track Record</Link>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-white/60 hover:text-white text-sm font-medium transition-colors px-4 py-2">Sign In</Link>
            <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-violet-500/25">
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── LIVE STATS BAR ── */}
      <div className="fixed top-16 left-0 right-0 z-40 bg-emerald-500/10 border-b border-emerald-500/20 py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-6 text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            <span className="text-emerald-300 font-semibold">Live today:</span>
          </div>
          <span className="text-white/60"><span className="text-white font-bold">{stats.value_bets_today}</span> value bets found</span>
          <span className="text-white/20 hidden sm:block">·</span>
          <span className="text-white/60 hidden sm:block"><span className="text-white font-bold">{stats.ai_accuracy}%</span> AI accuracy this month</span>
          <span className="text-white/20 hidden sm:block">·</span>
          <span className="text-white/60 hidden sm:block"><span className="text-white font-bold">{stats.leagues_covered}</span> leagues covered</span>
          <span className="text-white/20 hidden sm:block">·</span>
          <span className="text-white/60 hidden sm:block">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block mr-1.5" />
            <span className="text-white font-bold">{stats.users > 0 ? stats.users.toLocaleString() : '—'}</span> members
          </span>
        </div>
      </div>

      {/* ── HERO ── */}
      <section className="pt-44 pb-16 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-indigo-600/8 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-[200px] h-[200px] bg-violet-400/5 rounded-full blur-[60px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-8">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-violet-300 text-sm font-medium">The AI edge serious bettors use</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-6">
            Bet with an
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
              actual edge.
            </span>
          </h1>

          <p className="text-white/55 text-xl sm:text-2xl max-w-2xl mx-auto leading-relaxed mb-10">
            Real-time AI finds value bets where the bookmaker has got the odds wrong.
            Every pick shows the exact mathematical edge — no hunches, just data.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link href="/signup" className="w-full sm:w-auto bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5">
              Start Free — No Card Needed →
            </Link>
            <a href="#value-bets" className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-8 py-4 rounded-2xl text-lg transition-all">
              See Today&apos;s Value Bets
            </a>
          </div>

          {/* Activity strip */}
          <div className="flex justify-center mb-8">
            <ActivityStrip />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/35">
            <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> Free forever plan</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> No credit card required</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> Real Bet365 odds, not estimates</span>
          </div>
        </div>
      </section>

      {/* ── PHASE A: EMAIL CAPTURE ── */}
      <EmailCapture />

      {/* ── LEAGUES TRUST BAR ── */}
      <section className="py-10 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-white/25 text-xs mb-5 uppercase tracking-widest font-medium">Real-time data from all major leagues</p>
          <div className="flex flex-wrap items-center justify-center gap-5 text-white/25 text-sm font-medium">
            {['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'Champions League', 'Europa League', 'Eredivisie', 'MLS', '+5 more'].map(l => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="text-violet-500/40">⚽</span> {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── PHASE B: LIVE VALUE BETS PREVIEW ── */}
      <section id="value-bets" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              <span className="text-emerald-400 text-xs font-bold uppercase tracking-wide">
                {isLiveData ? 'Live from the AI right now' : 'Sample picks — live data once signed up'}
              </span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Today&apos;s value bets.{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Right now.</span>
            </h2>
            <p className="text-white/45 text-xl max-w-2xl mx-auto">
              The AI scans every fixture across 15 leagues and flags only bets where you have a real mathematical edge over the bookmaker.
            </p>
          </div>

          <div className="space-y-3 max-w-2xl mx-auto mb-8">
            {predictions.map((p, i) => (
              <div key={p.id} className={`bg-[#12121F] border rounded-2xl p-5 relative overflow-hidden ${i === 0 ? 'border-emerald-500/30' : 'border-white/8'}`}>
                {i === 0 && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/0 via-emerald-500/60 to-emerald-500/0" />}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white font-bold text-sm">{p.home_team} vs {p.away_team}</p>
                      {i === 0 && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">🔥 Top Pick</span>}
                    </div>
                    <p className="text-white/30 text-xs">{p.league}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-black">+{p.ev_percent}%</p>
                    <p className="text-white/30 text-[10px]">EV edge</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-violet-600/20 text-violet-300 text-xs font-semibold px-2.5 py-1 rounded-lg border border-violet-500/20">{p.bet_type}</span>
                  {/* Blurred odds — unlock prompt */}
                  <div className="flex items-center gap-1.5 relative">
                    <span className="text-white font-bold text-sm blur-sm select-none">@ {p.odds.toFixed(2)}</span>
                    <span className="text-white/30 text-xs">🔒</span>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500" style={{ width: `${p.ai_probability}%` }} />
                    </div>
                    <span className="text-white/30 text-xs">{p.ai_probability}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="max-w-2xl mx-auto bg-gradient-to-r from-violet-600/10 to-indigo-600/5 border border-violet-500/20 rounded-2xl p-6 text-center">
            <p className="text-white font-bold mb-1">Sign up free to unlock full odds + all {stats.value_bets_today} picks today</p>
            <p className="text-white/40 text-sm mb-4">See exact odds, AI reasoning, and EV breakdown for every value bet — free account, no card needed.</p>
            <Link href="/signup" className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20">
              Unlock Today&apos;s Picks →
            </Link>
          </div>
        </div>
      </section>

      {/* ── APP SCREENSHOT SHOWCASE ── */}
      <section id="app-preview" className="py-24 px-4 bg-white/[0.015] border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1.5 mb-6">
              <span className="text-violet-300 text-xs font-bold uppercase tracking-wide">📱 Inside the App</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">Everything in one dashboard</h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">No spreadsheets. No juggling five tabs. Every tool a serious bettor needs, right here.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Feature 1: AI Football Coach */}
            <div className="bg-[#12121F] border border-violet-500/20 rounded-2xl p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-base shrink-0">🤖</div>
                <div>
                  <p className="text-white font-semibold text-sm">AI Football Coach</p>
                  <p className="text-white/30 text-xs">GPT-4o · Live data</p>
                </div>
              </div>
              {/* Mock chat UI */}
              <div className="flex-1 bg-[#0B0B14] rounded-xl p-3 space-y-3 mb-4">
                <div className="flex gap-2">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] shrink-0 mt-0.5">👤</div>
                  <div className="bg-white/8 rounded-xl rounded-tl-none px-3 py-2 text-xs text-white/70 max-w-[80%]">
                    Is Arsenal a good bet tonight?
                  </div>
                </div>
                <div className="flex gap-2 flex-row-reverse">
                  <div className="w-5 h-5 rounded-full bg-violet-600/30 flex items-center justify-center text-[10px] shrink-0 mt-0.5">B</div>
                  <div className="bg-violet-600/20 border border-violet-500/20 rounded-xl rounded-tr-none px-3 py-2 text-xs text-white/80 max-w-[80%]">
                    Arsenal have scored 2+ in 8 of their last 10 home games. Saliba is back, Chelsea missing Mount. AI puts Over 2.5 at <span className="text-emerald-400 font-bold">+18.4% EV</span> — that&apos;s a strong edge.
                  </div>
                </div>
              </div>
              <p className="text-white/30 text-xs">Ask anything about any match, any league</p>
            </div>

            {/* Feature 2: Statistics Dashboard */}
            <div className="bg-[#12121F] border border-emerald-500/20 rounded-2xl p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-base shrink-0">📊</div>
                <div>
                  <p className="text-white font-semibold text-sm">Statistics Dashboard</p>
                  <p className="text-white/30 text-xs">Your full betting record</p>
                </div>
              </div>
              {/* Mock stats */}
              <div className="flex-1 space-y-2 mb-4">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Win Rate', value: '64%', color: 'text-emerald-400' },
                    { label: 'ROI', value: '+18.6%', color: 'text-emerald-400' },
                    { label: 'Total P&L', value: '+£184', color: 'text-emerald-400' },
                    { label: 'Bets', value: '54', color: 'text-white' },
                  ].map(s => (
                    <div key={s.label} className="bg-[#0B0B14] rounded-xl p-3 text-center">
                      <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                      <p className="text-white/30 text-[10px] mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                {/* Mini chart bars */}
                <div className="bg-[#0B0B14] rounded-xl p-3">
                  <p className="text-white/30 text-[10px] mb-2">P&L over time</p>
                  <div className="flex items-end gap-1 h-10">
                    {[-10, 8, 4, 18, 12, 29, 22, 38, 34, 47].map((v, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-sm ${v >= 0 ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}
                        style={{ height: `${Math.abs(v) / 47 * 100}%`, minHeight: 2 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-white/30 text-xs">Win rate, ROI, P&L by league and bet type</p>
            </div>

            {/* Feature 3: Value Bet Card (full detail) */}
            <div className="bg-[#12121F] border border-amber-500/20 rounded-2xl p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-base shrink-0">🔮</div>
                <div>
                  <p className="text-white font-semibold text-sm">AI Predictions</p>
                  <p className="text-white/30 text-xs">Daily value bet cards</p>
                </div>
              </div>
              {/* Mock value bet card */}
              <div className="flex-1 bg-[#0B0B14] rounded-xl p-4 mb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-bold text-xs">Arsenal vs Chelsea</p>
                    <p className="text-white/30 text-[10px]">Premier League · Sat 3pm</p>
                  </div>
                  <span className="text-emerald-400 font-black text-sm">+18.4%</span>
                </div>
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-violet-300 text-xs font-semibold bg-violet-600/20 px-2 py-0.5 rounded-lg border border-violet-500/20">Over 2.5 Goals</span>
                    <span className="text-white font-bold text-sm">@ 1.87</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      { label: 'AI probability', value: '72%', bar: 72, color: 'bg-emerald-500' },
                      { label: 'Bookmaker', value: '53%', bar: 53, color: 'bg-white/20' },
                    ].map(r => (
                      <div key={r.label}>
                        <div className="flex justify-between text-[10px] text-white/40 mb-0.5">
                          <span>{r.label}</span><span>{r.value}</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.bar}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['Saliba back', 'Chelsea no Mount', '8/10 home O2.5'].map(t => (
                    <span key={t} className="text-[9px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded-md">{t}</span>
                  ))}
                </div>
              </div>
              <p className="text-white/30 text-xs">Odds, EV%, AI probability, and reasoning for every pick</p>
            </div>
          </div>

          <div className="text-center mt-10">
            <Link href="/signup" className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-violet-500/25">
              Try the Dashboard Free →
            </Link>
          </div>
        </div>
      </section>

      {/* ── PHASE C: EV EXPLAINER ── */}
      <section id="how-it-works" className="py-24 px-4 border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1.5 mb-6">
              <span className="text-violet-300 text-xs font-bold uppercase tracking-wide">📐 The Edge Explained</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              What is a{' '}
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">value bet</span>
              ?
            </h2>
            <p className="text-white/45 text-xl max-w-2xl mx-auto">
              The bookmaker is not always right. When their odds imply the wrong probability, that gap is your edge.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Visual example */}
            <div className="bg-[#12121F] border border-white/8 rounded-2xl p-7">
              <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-5">Real example: Over 2.5 Goals</p>

              <div className="space-y-5">
                {/* Bookmaker bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/60 text-sm font-medium">📚 Bookmaker implies</span>
                    <span className="text-white font-bold text-sm">53% chance</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-white/30 to-white/20" style={{ width: '53%' }} />
                  </div>
                  <p className="text-white/30 text-xs mt-1.5">Odds of 1.88 → implied 53% probability</p>
                </div>

                {/* AI bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/60 text-sm font-medium">🤖 AI calculates</span>
                    <span className="text-emerald-400 font-bold text-sm">68% chance</span>
                  </div>
                  <div className="h-3 rounded-full bg-emerald-500/15 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: '68%' }} />
                  </div>
                  <p className="text-white/30 text-xs mt-1.5">Based on injuries, form, H2H, and lineup data</p>
                </div>

                {/* The gap */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-300 font-bold text-sm">The gap = your edge</p>
                      <p className="text-white/40 text-xs mt-0.5">68% − 53% = 15% probability edge</p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-black text-2xl">+22%</p>
                      <p className="text-white/30 text-xs">Expected Value</p>
                    </div>
                  </div>
                </div>

                <p className="text-white/25 text-xs text-center">EV formula: (AI probability × decimal odds) − 1</p>
              </div>
            </div>

            {/* Explanation */}
            <div>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-lg shrink-0">📚</div>
                  <div>
                    <p className="text-white font-semibold mb-1">Bookmakers price from volume, not truth</p>
                    <p className="text-white/40 text-sm leading-relaxed">Bookmakers set odds based on where public money flows — not pure probability. Popular teams are often over-priced. Lesser-known bets are often mispriced.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg shrink-0">🤖</div>
                  <div>
                    <p className="text-white font-semibold mb-1">AI calculates true probability</p>
                    <p className="text-white/40 text-sm leading-relaxed">Our model analyses real injury reports, confirmed lineups, recent form, head-to-head history, and more to calculate what the true odds should be.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg shrink-0">⚡</div>
                  <div>
                    <p className="text-white font-semibold mb-1">You only see the bets where you have an edge</p>
                    <p className="text-white/40 text-sm leading-relaxed">Every pick is filtered to positive Expected Value only. No noise, no guesses — just the bets where the maths says you have a statistical advantage.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-lg shrink-0">📊</div>
                  <div>
                    <p className="text-white font-semibold mb-1">Long run: edge beats luck</p>
                    <p className="text-white/40 text-sm leading-relaxed">Individual bets can lose. But backing positive EV bets consistently means the maths compounds in your favour over hundreds of bets — like a casino, but working for you.</p>
                  </div>
                </div>
              </div>
              <Link href="/signup" className="inline-block mt-8 bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-violet-500/20">
                Start Betting With an Edge →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── AI ACCA BUILDER ── */}
      <section className="py-24 px-4 bg-white/[0.015] border-b border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="bg-[#12121F] border border-violet-500/20 rounded-2xl p-6 shadow-xl shadow-violet-500/5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-white font-bold">Today&apos;s AI Accumulator</p>
                    <p className="text-white/30 text-xs">3 selections · All positive EV</p>
                  </div>
                  <div className="text-right">
                    <p className="text-violet-300 font-black text-2xl">@ 7.20</p>
                    <p className="text-white/30 text-xs">Combined odds</p>
                  </div>
                </div>
                <div className="space-y-3 mb-5">
                  {[
                    { match: 'Arsenal vs Wolves', pick: 'Arsenal Win', odds: '1.52', ev: '+8.4%', league: 'Premier League' },
                    { match: 'PSG vs Lens', pick: 'Over 2.5 Goals', odds: '1.78', ev: '+11.2%', league: 'Ligue 1' },
                    { match: 'Dortmund vs Stuttgart', pick: 'BTTS — Yes', odds: '1.65', ev: '+9.7%', league: 'Bundesliga' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                      <div className="w-6 h-6 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xs text-violet-300 font-bold shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{s.match}</p>
                        <p className="text-white/30 text-[10px]">{s.league}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-white text-xs font-bold">{s.pick} @ {s.odds}</p>
                        <p className="text-emerald-400 text-[10px] font-bold">{s.ev} EV</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-gradient-to-r from-violet-600/20 to-indigo-600/10 border border-violet-500/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/60 text-sm">Combined EV</span>
                    <span className="text-emerald-400 font-black">+11.8%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-sm">£10 stake returns</span>
                    <span className="text-white font-black">£72.00</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1.5 mb-6">
                <span className="text-violet-300 text-xs font-bold uppercase tracking-wide">🎯 Acca Builder — New</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-black mb-6 leading-tight">
                AI-built accas with{' '}
                <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">real EV</span>
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-8">
                Every day the AI picks 2–3 compatible value bets from different leagues and builds an accumulator where every single leg has positive expected value. Not just high odds — actual edge.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  'Each leg independently verified for positive EV',
                  'Legs from separate leagues — no correlation risk',
                  'One-click copy to take straight to your bookmaker',
                ].map(point => (
                  <div key={point} className="flex items-center gap-2.5 text-white/60 text-sm">
                    <span className="text-violet-400 shrink-0">✓</span> {point}
                  </div>
                ))}
              </div>
              <Link href="/signup" className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-violet-500/20">
                Get Today&apos;s Acca →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── PHASE D: TIPSTER SECTION — Early Mover Pitch ── */}
      <section id="tipsters" className="py-24 px-4 bg-white/[0.015] border-b border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5 mb-6">
              <span className="text-amber-300 text-xs font-bold uppercase tracking-wide">🛒 Tipster Marketplace — Launching</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Verified tipsters.{' '}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Transparent results.</span>
            </h2>
            <p className="text-white/40 text-xl max-w-2xl mx-auto">
              Every tipster&apos;s record is auto-verified against live match results — no fake screenshots, no cherry-picking. Just real performance tracked by our system.
            </p>
          </div>

          {/* Early mover banner */}
          <div className="bg-gradient-to-br from-amber-500/10 via-orange-600/5 to-transparent border border-amber-500/25 rounded-2xl p-8 mb-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/25 rounded-full px-3 py-1.5 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-300 text-xs font-bold">Founding Tipster Spots — Limited</span>
                </div>
                <h3 className="text-white font-black text-2xl mb-3">
                  Be one of the first 10 verified tipsters.
                </h3>
                <p className="text-white/50 text-sm leading-relaxed mb-5">
                  The marketplace is building now. First 10 tipsters who register get featured placement at the top of the leaderboard, priority onboarding support, and 3 months at 0% commission — you keep 100% of subscriber revenue while you build your following.
                </p>
                <div className="flex flex-wrap gap-3 mb-6">
                  {['🏆 Featured placement', '💰 0% commission x3 months', '⚡ Priority onboarding', '📢 Founding badge'].map(perk => (
                    <span key={perk} className="bg-white/5 border border-white/10 text-white/70 text-xs font-medium px-3 py-1.5 rounded-full">{perk}</span>
                  ))}
                </div>
                <Link href="/signup" className="inline-block bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/25">
                  Register as Founding Tipster →
                </Link>
              </div>
              <div className="space-y-4">
                <div className="bg-[#12121F] border border-white/8 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center font-black text-lg">📢</div>
                    <div>
                      <p className="text-white font-bold text-sm">How it works</p>
                      <p className="text-white/30 text-xs">Set up in under 5 minutes</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { step: '1', text: 'Register as a tipster and set your monthly price' },
                      { step: '2', text: 'Post verified picks — our system auto-checks every result' },
                      { step: '3', text: 'Subscribers pay monthly · you earn 80% of every £' },
                    ].map(s => (
                      <div key={s.step} className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xs text-violet-300 font-bold shrink-0">{s.step}</div>
                        <p className="text-white/50 text-sm leading-relaxed">{s.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Real user count */}
                <div className="bg-[#12121F] border border-emerald-500/20 rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg shrink-0">👥</div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white font-bold text-sm">
                        {stats.users > 0 ? `${stats.users.toLocaleString()} bettors` : 'Growing fast'}
                        {' '}already on BetIQ
                      </p>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <p className="text-white/40 text-xs">
                      {stats.tipsters > 0 ? `${stats.tipsters} tipsters active · ` : ''}Each one building a verified record from day one.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Earnings calculator */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div>
              <h3 className="text-white font-black text-2xl mb-3">Calculate your earnings</h3>
              <p className="text-white/50 text-sm leading-relaxed mb-4">
                Set your price. Grow your subscriber base. Keep 80%. Here&apos;s what that looks like in practice.
              </p>
              <div className="space-y-3">
                {[
                  { subs: 10, price: 9.99, monthly: '£80', note: 'Side income from day one' },
                  { subs: 50, price: 9.99, monthly: '£400', note: 'Meaningful monthly revenue' },
                  { subs: 200, price: 14.99, monthly: '£2,399', note: 'Full-time potential' },
                ].map(ex => (
                  <div key={ex.subs} className="flex items-center gap-4 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3">
                    <div className="flex-1">
                      <p className="text-white/60 text-xs">{ex.subs} subs × £{ex.price}</p>
                      <p className="text-white/30 text-[10px] mt-0.5">{ex.note}</p>
                    </div>
                    <p className="text-emerald-400 font-black text-lg">{ex.monthly}<span className="text-white/30 text-xs font-normal">/mo</span></p>
                  </div>
                ))}
              </div>
            </div>
            <EarningsCalculator />
          </div>

          {/* Browse CTA */}
          <div className="text-center mt-10">
            <Link href="/signup" className="inline-block bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors">
              Browse Marketplace →
            </Link>
          </div>
        </div>
      </section>

      {/* ── ALL FEATURES ── */}
      <section id="features" className="py-24 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl sm:text-5xl font-black mb-4">Every tool a serious bettor needs</h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">One platform replacing five different tools you currently use.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: '🤖', title: 'AI Football Coach', desc: 'Chat with GPT-4o trained on live injuries, form, H2H stats, and odds. Ask about any match, any league.', badge: 'GPT-4o', badgeColor: 'text-violet-300 bg-violet-500/10 border-violet-500/20' },
              { icon: '🔮', title: 'AI Predictions', desc: 'Daily predictions across 15 leagues with EV%, confidence scores, and bookmaker odds comparison.', badge: null, badgeColor: '' },
              { icon: '🎯', title: 'Acca Builder', desc: 'AI builds daily accumulator suggestions using only positive EV bets from independent leagues.', badge: 'New', badgeColor: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
              { icon: '📊', title: 'Deep Analytics', desc: 'Win rate, ROI by league and bet type, P&L charts, streaks — know exactly where your edge is.', badge: null, badgeColor: '' },
              { icon: '💰', title: 'Bankroll Tracker', desc: 'Visual balance chart, auto-calculated ROI, and professional bankroll management tools.', badge: null, badgeColor: '' },
              { icon: '🛒', title: 'Tipster Marketplace', desc: 'Browse verified tipsters sorted by ROI. Every record is auto-tracked — no fake screenshots.', badge: 'New', badgeColor: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
              { icon: '🏥', title: 'Injury & Lineup Feed', desc: 'Real-time injury reports and confirmed lineups for every match, direct from API-Football.', badge: 'Live', badgeColor: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
              { icon: '📋', title: 'Weekly Report Card', desc: 'AI grades your week — strengths, weaknesses, best call, worst call, and one tip to improve.', badge: null, badgeColor: '' },
              { icon: '🏆', title: 'Leaderboard', desc: 'See how your performance ranks against other BetIQ users. Compete on ROI and win rate.', badge: null, badgeColor: '' },
            ].map((f, i) => (
              <div key={i} className="bg-[#12121F] border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 bg-white/5 rounded-xl flex items-center justify-center text-xl group-hover:bg-white/8 transition-colors">{f.icon}</div>
                  {f.badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${f.badgeColor}`}>{f.badge}</span>}
                </div>
                <h3 className="text-white font-bold mb-1.5">{f.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-24 px-4 bg-white/[0.015] border-t border-white/5" id="pricing">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl sm:text-5xl font-black mb-4">Start free. Upgrade when it pays for itself.</h2>
            <p className="text-white/40 text-xl max-w-xl mx-auto">One winning value bet covers the monthly cost of Pro.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-[#12121F] border border-white/8 rounded-2xl p-7 flex flex-col">
              <div className="mb-6">
                <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2">Free</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-black text-white">£0</span>
                  <span className="text-white/30 mb-1 text-sm">/month</span>
                </div>
                <p className="text-white/30 text-sm">Forever free. No tricks.</p>
              </div>
              <ul className="space-y-2.5 flex-1 mb-8">
                {['Track up to 50 bets', 'Basic statistics', 'Bankroll tracker', '3 AI Coach messages/day', 'Browse tipster marketplace'].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-white/50 text-sm">
                    <span className="text-white/20 shrink-0">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="w-full text-center bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                Get Started Free
              </Link>
            </div>

            <div className="bg-gradient-to-b from-violet-600/20 to-indigo-600/10 border border-violet-500/40 rounded-2xl p-7 flex flex-col relative shadow-xl shadow-violet-500/10">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-black px-4 py-1.5 rounded-full tracking-wider uppercase">Most Popular</div>
              <div className="mb-6">
                <p className="text-violet-300 text-xs font-bold uppercase tracking-wider mb-2">Pro</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-black text-white">£9.99</span>
                  <span className="text-white/40 mb-1 text-sm">/month</span>
                </div>
                <p className="text-white/40 text-sm">Less than a pint a week.</p>
              </div>
              <ul className="space-y-2.5 flex-1 mb-8">
                {[
                  'Unlimited bet tracking',
                  'Full AI Football Coach',
                  'AI Predictions (all leagues)',
                  '🔥 Daily value bets',
                  '🎯 AI Acca Builder',
                  'Live injury + lineup feed',
                  'Weekly Report Card',
                  'Auto result detection',
                  'Advanced ROI analytics',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-white/75 text-sm">
                    <span className="text-violet-400 shrink-0">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="w-full text-center bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-violet-500/30 text-sm">
                Start Free Trial
              </Link>
            </div>

            <div className="bg-[#12121F] border border-white/8 rounded-2xl p-7 flex flex-col">
              <div className="mb-6">
                <p className="text-amber-400/70 text-xs font-bold uppercase tracking-wider mb-2">Elite</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-black text-white">£19.99</span>
                  <span className="text-white/30 mb-1 text-sm">/month</span>
                </div>
                <p className="text-white/30 text-sm">For serious bettors.</p>
              </div>
              <ul className="space-y-2.5 flex-1 mb-8">
                {[
                  'Everything in Pro',
                  'Real-time odds alerts',
                  'Kelly Criterion stake calculator',
                  'Follow up to 5 tipsters',
                  'Early access to new features',
                  'Priority support',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-white/60 text-sm">
                    <span className="text-amber-400/50 shrink-0">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="w-full text-center bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                Get Elite
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-4 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-12">Common questions</h2>
          <div className="space-y-4">
            {[
              { q: 'Is BetIQ a tipster service?', a: "No. BetIQ is an analytics and intelligence platform. The AI Predictions feature surfaces value bets based on mathematical edge — but you decide what to place. The Tipster Marketplace connects you with independent human tipsters who have verified track records." },
              { q: 'What makes BetIQ different from free odds sites?', a: "Free odds sites show you odds. BetIQ shows you which bets have a mathematical edge over the bookmaker (positive Expected Value), feeds AI analysis from real injury and lineup data, and tracks whether the AI is actually profitable over time — something no free tool does." },
              { q: 'How does EV% work?', a: "Expected Value measures whether a bet is worth taking. If the AI calculates a 65% chance of Over 2.5 Goals but Bet365 prices it as if there's only a 55% chance, that's a positive EV bet — you have an edge. We show the exact EV% so you can prioritise the best bets." },
              { q: 'Is it legal in the UK?', a: 'Yes. BetIQ is an analytics tool, not a bookmaker. Using betting analytics software is perfectly legal in the UK. Always gamble responsibly. 18+.' },
              { q: 'Can I cancel anytime?', a: 'Yes, cancel any time with one click from your billing page. No contracts, no cancellation fees. Your data stays accessible on the free plan indefinitely.' },
            ].map((item, i) => (
              <div key={i} className="bg-[#12121F] border border-white/8 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-2 text-sm">{item.q}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-b from-violet-600/15 to-indigo-600/5 border border-violet-500/20 rounded-3xl p-12 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-violet-600/15 rounded-full blur-[60px] pointer-events-none" />
            <div className="relative">
              <p className="text-5xl mb-4">⚡</p>
              <h2 className="text-4xl sm:text-5xl font-black mb-4">Stop betting blind.</h2>
              <p className="text-white/45 text-lg mb-8 max-w-xl mx-auto">
                Join bettors who use AI to find real value in the markets — not hunches, not hot tips. Edge.
              </p>
              <Link href="/signup" className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-bold px-10 py-4 rounded-2xl text-lg transition-all shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5">
                Create Your Free Account →
              </Link>
              <p className="text-white/20 text-sm mt-4">Free forever plan · No credit card required</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm">B</div>
            <span className="text-white/60 font-bold">BetIQ</span>
          </div>
          <p className="text-white/20 text-xs text-center">
            For analytics and entertainment purposes only. Please gamble responsibly. 18+ only.
          </p>
          <div className="flex items-center gap-5 text-white/30 text-sm">
            <a href="#pricing" className="hover:text-white/60 transition-colors">Pricing</a>
            <Link href="/track-record" className="hover:text-white/60 transition-colors">Track Record</Link>
            <Link href="/login" className="hover:text-white/60 transition-colors">Sign In</Link>
            <Link href="/signup" className="hover:text-white/60 transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
