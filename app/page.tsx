import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#0B0B14] text-white">

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B14]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-violet-500/30">B</div>
            <span className="text-white font-bold text-xl tracking-tight">Bet<span className="text-violet-400">IQ</span></span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-white/60 hover:text-white text-sm font-medium transition-colors px-4 py-2">
              Sign In
            </Link>
            <Link href="/signup" className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-indigo-600/8 rounded-full blur-[80px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-8">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-violet-300 text-sm font-medium">AI-Powered Betting Intelligence</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-tight tracking-tight mb-6">
            Stop Guessing.
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-violet-300 bg-clip-text text-transparent">
              Start Winning.
            </span>
          </h1>

          <p className="text-white/55 text-xl sm:text-2xl max-w-2xl mx-auto leading-relaxed mb-10">
            BetIQ is the AI betting coach that tracks every bet, spots your patterns,
            and gives you real football intelligence — so you bet smarter, not harder.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/signup" className="w-full sm:w-auto bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5">
              Start Free — No Card Needed
            </Link>
            <Link href="/login" className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-8 py-4 rounded-2xl text-lg transition-all">
              Sign In →
            </Link>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-white/40">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-base">✓</span> Free forever plan
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-base">✓</span> No credit card required
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-base">✓</span> Set up in 2 minutes
            </div>
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="max-w-5xl mx-auto mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B14] via-transparent to-transparent z-10 pointer-events-none" style={{top: '70%'}} />
          <div className="bg-[#12121F] border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/50">
            {/* Mock dashboard header */}
            <div className="flex items-center gap-2 mb-5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-amber-500/60" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              <div className="ml-2 text-white/20 text-xs">localhost:3000/dashboard</div>
            </div>
            {/* Mock stat cards */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Current Streak', value: '🔥 7', sub: '7 wins in a row', color: 'text-white' },
                { label: 'Win Rate', value: '68%', sub: '34W · 16L', color: 'text-white' },
                { label: 'Total P&L', value: '+£847', sub: 'all time', color: 'text-emerald-400' },
                { label: 'Pending', value: '3', sub: 'awaiting results', color: 'text-amber-400' },
              ].map((s, i) => (
                <div key={i} className="bg-[#0B0B14] border border-white/5 rounded-xl p-3">
                  <p className="text-white/30 text-xs mb-1">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-white/20 text-xs">{s.sub}</p>
                </div>
              ))}
            </div>
            {/* Mock pending bets */}
            <div className="bg-[#0B0B14] border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Pending Bets</p>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">🔍 Auto-check results</span>
              </div>
              {[
                { match: 'Arsenal vs Chelsea', bet: 'Over 2.5 Goals · £50 @ 1.85', profit: '+£42.50' },
                { match: 'Man City vs Liverpool', bet: 'Man City Win · £30 @ 2.10', profit: '+£33.00' },
              ].map((b, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{b.match}</p>
                    <p className="text-white/30 text-xs">{b.bet}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20">{b.profit} ✓</span>
                    <span className="text-xs bg-red-500/15 text-red-400 px-2.5 py-1 rounded-lg border border-red-500/20">-£{i === 0 ? '50' : '30'} ✗</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── LEAGUES TRUST BAR ── */}
      <section className="py-10 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-white/30 text-sm mb-6 uppercase tracking-widest font-medium">Covering all major leagues</p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-white/25 text-sm font-medium">
            {['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'Champions League', 'Europa League', 'MLS'].map(l => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="text-violet-500/50">⚽</span> {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Everything you need to{' '}
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                bet smarter
              </span>
            </h2>
            <p className="text-white/40 text-xl max-w-2xl mx-auto">
              One platform combining AI coaching, real football data, and detailed analytics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: '🤖',
                title: 'AI Football Coach',
                desc: 'Chat with an AI that knows current injuries, team form, head-to-head stats and betting markets. Ask anything about any match.',
                badge: 'Most Popular',
                badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
              },
              {
                icon: '📊',
                title: 'Deep Analytics',
                desc: 'Track win rate, ROI by league, ROI by bet type, streaks, and P&L over time. Instantly see where you make money and where you lose it.',
                badge: null,
                badgeColor: '',
              },
              {
                icon: '💰',
                title: 'Bankroll Tracker',
                desc: 'Set your starting bankroll and watch it grow. Visual charts of your balance over time with every snapshot recorded automatically.',
                badge: null,
                badgeColor: '',
              },
              {
                icon: '📰',
                title: 'Live Football News',
                desc: 'Real-time injury reports, lineup news, transfer updates and match previews pulled fresh before every session.',
                badge: 'Live Data',
                badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
              },
              {
                icon: '🔍',
                title: 'Auto Result Detection',
                desc: 'AI automatically checks match scores and marks your pending bets as won or lost — no manual input needed.',
                badge: null,
                badgeColor: '',
              },
              {
                icon: '📋',
                title: 'Weekly Report Card',
                desc: 'Every week, get an AI-generated grade on your betting. Strengths, weaknesses, best call, worst call, and a tip for next week.',
                badge: null,
                badgeColor: '',
              },
            ].map((f, i) => (
              <div key={i} className="bg-[#12121F] border border-white/8 rounded-2xl p-6 hover:border-violet-500/20 transition-all hover:-translate-y-0.5 group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center text-2xl group-hover:bg-violet-500/20 transition-colors">
                    {f.icon}
                  </div>
                  {f.badge && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${f.badgeColor}`}>
                      {f.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-4 bg-white/[0.015] border-y border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black mb-4">Up and running in minutes</h2>
            <p className="text-white/40 text-lg">No setup required. Start tracking from your very first bet.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-1/3 right-1/3 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
            {[
              { step: '01', icon: '👤', title: 'Create your free account', desc: 'Sign up in seconds with just your email. No credit card, no commitment.' },
              { step: '02', icon: '⚽', title: 'Log your first bet', desc: 'Add bets manually or take a photo of your bet slip — our AI reads it for you.' },
              { step: '03', icon: '📈', title: 'Get smarter every week', desc: 'Your AI coach analyses your patterns and tells you exactly how to improve.' },
            ].map((s, i) => (
              <div key={i} className="text-center relative">
                <div className="w-16 h-16 bg-violet-600/15 border border-violet-500/20 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                  {s.icon}
                </div>
                <div className="text-violet-500/40 text-xs font-black tracking-widest mb-2">STEP {s.step}</div>
                <h3 className="text-white font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-24 px-4" id="pricing">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Less than one losing bet per month
            </h2>
            <p className="text-white/40 text-xl max-w-xl mx-auto">
              Start free. Upgrade when BetIQ has already made you more than it costs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="bg-[#12121F] border border-white/8 rounded-2xl p-7 flex flex-col">
              <div className="mb-6">
                <p className="text-white/50 text-sm font-semibold uppercase tracking-wider mb-2">Free</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-black text-white">£0</span>
                  <span className="text-white/30 mb-1">/month</span>
                </div>
                <p className="text-white/30 text-sm">Forever free. No tricks.</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {['Track up to 50 bets', 'Basic statistics', 'Bankroll tracker', 'CSV export'].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-white/60 text-sm">
                    <span className="text-white/20">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="w-full text-center bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-colors">
                Get Started Free
              </Link>
            </div>

            {/* Pro — highlighted */}
            <div className="bg-gradient-to-b from-violet-600/20 to-indigo-600/10 border border-violet-500/40 rounded-2xl p-7 flex flex-col relative shadow-xl shadow-violet-500/10">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-black px-4 py-1.5 rounded-full tracking-wider uppercase">
                Most Popular
              </div>
              <div className="mb-6">
                <p className="text-violet-300 text-sm font-semibold uppercase tracking-wider mb-2">Pro</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-black text-white">£9.99</span>
                  <span className="text-white/40 mb-1">/month</span>
                </div>
                <p className="text-white/40 text-sm">Less than a pint a week.</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  'Unlimited bet tracking',
                  'Full AI Football Coach',
                  'Live news feed',
                  'Weekly Report Card',
                  'Auto result detection',
                  'Advanced analytics & ROI charts',
                  'Photo bet slip scanning (OCR)',
                  'Priority support',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-white/75 text-sm">
                    <span className="text-violet-400">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="w-full text-center bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-violet-500/30">
                Start Free Trial
              </Link>
            </div>

            {/* Elite */}
            <div className="bg-[#12121F] border border-white/8 rounded-2xl p-7 flex flex-col">
              <div className="mb-6">
                <p className="text-amber-400/70 text-sm font-semibold uppercase tracking-wider mb-2">Elite</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-black text-white">£19.99</span>
                  <span className="text-white/30 mb-1">/month</span>
                </div>
                <p className="text-white/30 text-sm">For serious bettors.</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  'Everything in Pro',
                  'Real-time odds comparison',
                  'Value bet alerts',
                  'Kelly Criterion stake calculator',
                  'API access',
                  'Early access to new features',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-white/60 text-sm">
                    <span className="text-amber-400/50">✓</span> {f}
                  </li>
                ))}
                <li className="flex items-center gap-2.5 text-white/30 text-xs">
                  <span>🔜</span> Value bets coming soon
                </li>
              </ul>
              <Link href="/signup" className="w-full text-center bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-colors">
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
          <div className="space-y-5">
            {[
              {
                q: 'Is BetIQ a tipster service?',
                a: "No. BetIQ is an analytics and coaching platform. We don't tell you what to bet — we help you understand your own betting patterns and make more informed decisions. Think of it as a personal trainer for your betting, not a betting service.",
              },
              {
                q: 'Is it legal to use in the UK?',
                a: 'Yes. BetIQ is an analytics tool, not a bookmaker. Using betting analytics software is perfectly legal in the UK. Always gamble responsibly.',
              },
              {
                q: 'How does the AI coach actually work?',
                a: 'The AI coach is powered by GPT-4o with access to your full betting history and current football data. It gives personalised advice based on your specific patterns — not generic tips.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes, cancel any time with one click. No contracts, no cancellation fees. Your data stays accessible on the free plan.',
              },
            ].map((item, i) => (
              <div key={i} className="bg-[#12121F] border border-white/8 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-2">{item.q}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-b from-violet-600/15 to-indigo-600/5 border border-violet-500/20 rounded-3xl p-12">
            <div className="text-5xl mb-4">⚽</div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Ready to bet smarter?
            </h2>
            <p className="text-white/45 text-lg mb-8 max-w-xl mx-auto">
              Join bettors who track, analyse, and improve with BetIQ.
              Free to start, no card needed.
            </p>
            <Link href="/signup" className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-bold px-10 py-4 rounded-2xl text-lg transition-all shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5">
              Create Your Free Account →
            </Link>
            <p className="text-white/20 text-sm mt-4">No credit card required · Free forever plan available</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm">B</div>
            <span className="text-white/60 font-semibold">BetIQ</span>
          </div>
          <p className="text-white/20 text-sm text-center">
            For entertainment and analytics purposes only. Please gamble responsibly. 18+
          </p>
          <div className="flex items-center gap-5 text-white/30 text-sm">
            <Link href="/login" className="hover:text-white/60 transition-colors">Sign In</Link>
            <Link href="/signup" className="hover:text-white/60 transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
