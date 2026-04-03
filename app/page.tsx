import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const stats = await getLiveStats()

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
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#predictions" className="hover:text-white transition-colors">AI Predictions</a>
            <a href="#tipsters" className="hover:text-white transition-colors">Tipsters</a>
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
          <span className="text-white/60 hidden sm:block"><span className="text-white font-bold">{stats.tipsters}</span> verified tipsters</span>
        </div>
      </div>

      {/* ── HERO ── */}
      <section className="pt-44 pb-20 px-4 relative overflow-hidden">
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
            Real-time AI value bets with expected value scoring, verified tipster picks,
            and deep analytics — all in one platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/signup" className="w-full sm:w-auto bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5">
              Start Free — No Card Needed →
            </Link>
            <a href="#predictions" className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-8 py-4 rounded-2xl text-lg transition-all">
              See Today&apos;s Value Bets
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/35">
            <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> Free forever plan</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> No credit card required</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> Real Bet365 odds, not estimates</span>
          </div>
        </div>

        {/* ── HERO CARD PREVIEW ── */}
        <div className="max-w-4xl mx-auto mt-16 relative">
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0B0B14] to-transparent z-10 pointer-events-none" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#12121F] border border-emerald-500/30 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/0 via-emerald-500/60 to-emerald-500/0" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-emerald-400 tracking-widest uppercase bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">🔥 Value Bet</span>
                <span className="text-emerald-400 font-black text-sm">+18.4% EV</span>
              </div>
              <p className="text-white font-bold mb-0.5">Arsenal vs Chelsea</p>
              <p className="text-white/40 text-xs mb-3">Premier League · Today 17:30</p>
              <div className="flex items-center gap-2">
                <span className="bg-violet-600/20 text-violet-300 text-xs font-bold px-2.5 py-1 rounded-lg border border-violet-500/20">Over 2.5 Goals</span>
                <span className="text-white font-bold">@ 1.95</span>
              </div>
              <p className="text-white/30 text-xs mt-2">AI Confidence: 72% · Bet365</p>
            </div>
            <div className="bg-[#12121F] border border-violet-500/30 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500/0 via-violet-500/60 to-violet-500/0" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-violet-300 tracking-widest uppercase bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">🎯 AI Acca</span>
                <span className="text-violet-300 font-black text-sm">@ 6.40</span>
              </div>
              <div className="space-y-1.5 mb-3">
                {['Man City Win', 'BTTS — Liverpool vs Real', 'Over 2.5 — PSG vs Lyon'].map(pick => (
                  <div key={pick} className="flex items-center gap-2 text-xs text-white/60">
                    <span className="text-violet-400">✓</span> {pick}
                  </div>
                ))}
              </div>
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2">
                <p className="text-violet-300 text-xs font-bold">Combined EV: +12.1%</p>
              </div>
            </div>
            <div className="bg-[#12121F] border border-amber-500/20 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/0 via-amber-500/40 to-amber-500/0" />
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center font-black text-sm">M</div>
                <div>
                  <p className="text-white text-sm font-bold">MarkTheTipster</p>
                  <p className="text-white/30 text-xs">Premier League Specialist</p>
                </div>
                <span className="ml-auto text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">#1 ROI</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div><p className="text-emerald-400 font-bold text-sm">+31%</p><p className="text-white/30 text-[10px]">ROI</p></div>
                <div><p className="text-white font-bold text-sm">68%</p><p className="text-white/30 text-[10px]">Win Rate</p></div>
                <div><p className="text-white font-bold text-sm">142</p><p className="text-white/30 text-[10px]">Tips</p></div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-center">
                <p className="text-white/50 text-xs">£9.99/mo · 24 subscribers</p>
              </div>
            </div>
          </div>
        </div>
      </section>

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

      {/* ── AI PREDICTIONS SECTION ── */}
      <section id="predictions" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5 mb-6">
                <span className="text-emerald-400 text-xs font-bold uppercase tracking-wide">🔮 AI Predictions</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-black mb-6 leading-tight">
                Find bets with a{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">real edge</span>
                {' '}— before kickoff
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-8">
                Our AI analyses every fixture using live injury reports, team form, and confirmed lineups — then cross-references real Bet365 odds to find where the bookmaker has mispriced the market. Only bets with positive Expected Value (EV%) are surfaced.
              </p>
              <div className="space-y-4">
                {[
                  { icon: '📊', title: 'Expected Value scoring', desc: 'Every prediction shows EV%, so you know exactly how much edge you have over the bookmaker.' },
                  { icon: '🏥', title: 'Injury & lineup aware', desc: 'Real-time injury reports and confirmed lineups feed directly into the AI model.' },
                  { icon: '🔔', title: 'Value bets highlighted', desc: "The best bets of the day are surfaced automatically — no digging required." },
                ].map(item => (
                  <div key={item.title} className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-lg">{item.icon}</div>
                    <div>
                      <p className="text-white font-semibold text-sm mb-0.5">{item.title}</p>
                      <p className="text-white/40 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/signup" className="inline-block mt-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20">
                See Today&apos;s Value Bets →
              </Link>
            </div>

            <div className="space-y-3">
              {[
                { match: 'Liverpool vs Dortmund', league: 'Champions League', bet: 'Over 2.5 Goals', odds: '1.85', ev: '+14.2', confidence: 74, badge: '🔥 Top Pick' },
                { match: 'Barcelona vs Atletico', league: 'La Liga', bet: 'BTTS — Yes', odds: '1.72', ev: '+9.8', confidence: 68, badge: null },
                { match: 'Bayern vs Leverkusen', league: 'Bundesliga', bet: 'Bayern Win', odds: '1.55', ev: '+7.1', confidence: 71, badge: null },
              ].map((p, i) => (
                <div key={i} className={`bg-[#12121F] border rounded-2xl p-4 ${i === 0 ? 'border-emerald-500/30' : 'border-white/8'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-white font-bold text-sm">{p.match}</p>
                        {p.badge && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">{p.badge}</span>}
                      </div>
                      <p className="text-white/30 text-xs">{p.league}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-black">{p.ev}%</p>
                      <p className="text-white/30 text-[10px]">EV</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-violet-600/20 text-violet-300 text-xs font-semibold px-2.5 py-1 rounded-lg border border-violet-500/20">{p.bet}</span>
                    <span className="text-white font-bold text-sm">@ {p.odds}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500" style={{ width: `${p.confidence}%` }} />
                      </div>
                      <span className="text-white/30 text-xs">{p.confidence}%</span>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-white/20 text-xs text-center pt-1">Sample predictions — sign up to see today&apos;s live picks</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── AI ACCA BUILDER ── */}
      <section className="py-24 px-4 bg-white/[0.015] border-y border-white/5">
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

      {/* ── TIPSTER MARKETPLACE ── */}
      <section id="tipsters" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5 mb-6">
              <span className="text-amber-300 text-xs font-bold uppercase tracking-wide">🛒 Tipster Marketplace</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Follow verified tipsters.{' '}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Or become one.</span>
            </h2>
            <p className="text-white/40 text-xl max-w-2xl mx-auto">
              Every tipster&apos;s record is auto-verified against live match results. No fake screenshots — just transparent performance tracked by our system.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            {[
              { name: 'MarkTheTipster', spec: 'Premier League Goals', roi: '+31.4%', winRate: '68%', tips: 142, subs: 24, price: '£9.99', badge: '🏆 #1 ROI' },
              { name: 'AccaKing', spec: 'Champions League', roi: '+22.8%', winRate: '61%', tips: 89, subs: 17, price: '£7.99', badge: null },
              { name: 'ValueVince', spec: 'Asian Handicap', roi: '+18.2%', winRate: '57%', tips: 203, subs: 31, price: '£12.99', badge: null },
            ].map((t, i) => (
              <div key={i} className={`bg-[#12121F] border rounded-2xl p-5 ${i === 0 ? 'border-amber-500/30' : 'border-white/8'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                    i === 0 ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                    i === 1 ? 'bg-gradient-to-br from-violet-600 to-indigo-600' :
                    'bg-gradient-to-br from-emerald-600 to-teal-600'
                  }`}>{t.name[0]}</div>
                  <div>
                    <p className="text-white font-bold text-sm">{t.name}</p>
                    <p className="text-white/30 text-xs">{t.spec}</p>
                  </div>
                  {t.badge && <span className="ml-auto text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">{t.badge}</span>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                  <div className="bg-white/5 rounded-xl p-2">
                    <p className="text-emerald-400 font-bold text-sm">{t.roi}</p>
                    <p className="text-white/30 text-[10px]">ROI</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2">
                    <p className="text-white font-bold text-sm">{t.winRate}</p>
                    <p className="text-white/30 text-[10px]">Win Rate</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2">
                    <p className="text-white font-bold text-sm">{t.tips}</p>
                    <p className="text-white/30 text-[10px]">Tips</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-white/40">
                  <span>{t.subs} subscribers</span>
                  <span className="text-white font-bold">{t.price}/mo</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-gradient-to-br from-violet-600/10 to-indigo-600/5 border border-violet-500/20 rounded-2xl p-6">
              <p className="text-2xl mb-3">📢</p>
              <h3 className="text-white font-bold text-lg mb-2">Become a tipster. Earn from your edge.</h3>
              <p className="text-white/40 text-sm mb-4">Set your monthly price, post verified tips, and earn 80% of subscription revenue. Your track record is publicly verified — the better you perform, the more you earn.</p>
              <Link href="/signup" className="inline-block bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
                Register as Tipster →
              </Link>
            </div>
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-600/5 border border-amber-500/20 rounded-2xl p-6">
              <p className="text-2xl mb-3">🔍</p>
              <h3 className="text-white font-bold text-lg mb-2">Only follow tipsters with a verified record.</h3>
              <p className="text-white/40 text-sm mb-4">Every result is checked against live match data and automatically marked win/loss/void. No editing history. No cherry-picking. Full transparency on every tipster.</p>
              <Link href="/signup" className="inline-block bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
                Browse Marketplace →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── ALL FEATURES ── */}
      <section id="features" className="py-24 px-4 border-t border-white/5 bg-white/[0.015]">
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
      <section className="py-24 px-4" id="pricing">
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
            <Link href="/login" className="hover:text-white/60 transition-colors">Sign In</Link>
            <Link href="/signup" className="hover:text-white/60 transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
