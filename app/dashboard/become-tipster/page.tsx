'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PRICE_PRESETS = [
  { label: '£4.99', value: '4.99' },
  { label: '£9.99', value: '9.99', popular: true },
  { label: '£14.99', value: '14.99' },
  { label: '£19.99', value: '19.99' },
]

const STEPS = [
  { icon: '📢', title: 'Post Your Picks', desc: 'Share free teasers to attract followers, premium tips to earn money' },
  { icon: '📊', title: 'Build a Track Record', desc: 'All results verified automatically — no faking results' },
  { icon: '👥', title: 'Grow Your Audience', desc: 'We put you in front of serious bettors looking for value' },
  { icon: '💰', title: 'Earn Every Month', desc: 'Get paid monthly. Founding tipsters keep 90% of every subscription' },
]

const SUCCESS_STORIES = [
  { name: 'GoalMachine', specialty: 'Over/Under Specialist', subs: 124, monthly: '£1,110', roi: '+18%', tips: 312 },
  { name: 'ValueKing', specialty: 'Premier League', subs: 67, monthly: '£600', roi: '+24%', tips: 189 },
  { name: 'AsianEdge', specialty: 'Asian Handicap', subs: 203, monthly: '£1,820', roi: '+31%', tips: 540 },
]

function EarningsCalculator({ price, isFounder }: { price: string; isFounder: boolean }) {
  const [subs, setSubs] = useState(50)
  const p = parseFloat(price) || 9.99
  const platformFee = isFounder ? 0.10 : 0.20
  const cut = p * (1 - platformFee)
  const monthly = cut * subs
  const annual = monthly * 12

  const milestones = [
    { subs: 10, label: '10 subs' },
    { subs: 50, label: '50 subs' },
    { subs: 100, label: '100 subs' },
    { subs: 250, label: '250 subs' },
  ]

  return (
    <div className="bg-[#0B0B14] border border-white/10 rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">💰</span>
          <p className="text-white font-semibold text-sm">Earnings Calculator</p>
        </div>
        {isFounder && (
          <span className="text-[10px] font-bold text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded-full">
            90% FOUNDER RATE
          </span>
        )}
      </div>

      {/* Subscriber slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-white/50 text-xs">Estimated subscribers</label>
          <span className="text-white font-bold">{subs}</span>
        </div>
        <input
          type="range"
          min={1} max={500} step={1}
          value={subs}
          onChange={e => setSubs(Number(e.target.value))}
          className="w-full accent-violet-500 cursor-pointer"
        />
        <div className="flex justify-between text-white/20 text-[10px] mt-1">
          <span>1</span><span>100</span><span>250</span><span>500</span>
        </div>
      </div>

      {/* Quick milestone buttons */}
      <div className="flex gap-2 flex-wrap">
        {milestones.map(m => (
          <button
            key={m.subs}
            type="button"
            onClick={() => setSubs(m.subs)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
              subs === m.subs
                ? 'bg-violet-600/30 border-violet-500/40 text-violet-300'
                : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Revenue rows */}
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-white/[0.03] rounded-xl px-4 py-3">
          <div>
            <p className="text-white/50 text-xs">Monthly earnings</p>
            <p className="text-white/25 text-[10px] mt-0.5">{subs} × £{cut.toFixed(2)} your cut</p>
          </div>
          <p className="text-emerald-400 font-black text-xl">£{monthly.toFixed(0)}</p>
        </div>
        <div className="flex items-center justify-between bg-emerald-500/8 border border-emerald-500/15 rounded-xl px-4 py-3">
          <div>
            <p className="text-white/60 text-xs">Annual earnings</p>
            <p className="text-white/25 text-[10px] mt-0.5">12 months at same rate</p>
          </div>
          <p className="text-emerald-300 font-black text-2xl">£{annual.toFixed(0)}</p>
        </div>
      </div>

      <p className="text-white/25 text-[10px] text-center">
        You keep {isFounder ? '90%' : '80%'} · {isFounder ? '10%' : '20%'} platform fee
        {isFounder ? ' (founding tipster rate — first 3 months free)' : ''}
      </p>
    </div>
  )
}

export default function BecomeTipsterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ display_name: '', bio: '', speciality: '', monthly_price: '9.99' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  // Founding tipster = always true for now (first N tipsters)
  const isFounder = true

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/tipsters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, monthly_price: parseFloat(form.monthly_price) }),
    })
    const data = await res.json()
    if (data.error) { setError(data.error); setLoading(false); return }
    router.push('/dashboard/my-tipster')
  }

  const shareText = encodeURIComponent("I just set up my tipster profile on BetIQ — AI-powered football betting tracker. Join me and see if you can beat the AI 👀⚽")
  const shareUrl = encodeURIComponent("https://footballbetai.vercel.app/signup")

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">

      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-full px-4 py-1.5 text-amber-300 text-xs font-semibold mb-5">
          🔥 Founding Tipster Applications Open — Limited Spots
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight">
          Turn Your Football Knowledge<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">Into Monthly Income</span>
        </h1>
        <p className="text-white/50 text-base max-w-xl mx-auto mb-6">
          Post your tips, build a verified track record, and earn from subscribers — all on BetIQ's growing platform.
          Founding tipsters keep <span className="text-amber-300 font-bold">90%</span> of every subscription.
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-violet-500/25"
          >
            🚀 Apply as Founding Tipster
          </button>
        )}
      </div>

      {/* How it works */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {STEPS.map((step, i) => (
          <div key={step.title} className="bg-[#13162b] border border-white/8 rounded-2xl p-4 text-center">
            <div className="text-2xl mb-2">{step.icon}</div>
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <span className="w-4 h-4 rounded-full bg-violet-600/30 border border-violet-500/30 text-[9px] font-black text-violet-300 flex items-center justify-center">{i + 1}</span>
              <p className="text-white text-xs font-bold">{step.title}</p>
            </div>
            <p className="text-white/35 text-[10px] leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* Founder perks banner */}
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/25 rounded-2xl p-5 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🏆</span>
          <p className="text-amber-300 font-bold text-sm">Founding Tipster Perks — Only for the First 50</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: '💰', perk: '0% Commission', detail: 'First 3 months free, then keep 90%' },
            { icon: '📌', perk: 'Top Placement', detail: 'Featured at top of Marketplace' },
            { icon: '⚡', perk: 'Priority Support', detail: 'Direct line to our team' },
            { icon: '🏅', perk: 'Founder Badge', detail: 'Exclusive profile badge forever' },
          ].map(p => (
            <div key={p.perk} className="bg-white/[0.04] rounded-xl p-3">
              <p className="text-lg mb-1">{p.icon}</p>
              <p className="text-white text-xs font-bold">{p.perk}</p>
              <p className="text-white/35 text-[10px] mt-0.5">{p.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Social proof — example tipsters */}
      <div className="mb-8">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3 text-center">Example of what top tipsters earn</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SUCCESS_STORIES.map(s => (
            <div key={s.name} className="bg-[#13162b] border border-white/8 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white font-bold text-sm">{s.name}</p>
                  <p className="text-white/35 text-xs">{s.specialty}</p>
                </div>
                <span className="text-emerald-400 text-xs font-black bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">{s.roi} ROI</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-white font-bold text-sm">{s.subs}</p>
                  <p className="text-white/30 text-[10px]">Subscribers</p>
                </div>
                <div>
                  <p className="text-emerald-400 font-black text-sm">{s.monthly}</p>
                  <p className="text-white/30 text-[10px]">/ month</p>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{s.tips}</p>
                  <p className="text-white/30 text-[10px]">Tips posted</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-white/20 text-[10px] text-center mt-2">Illustrative examples based on platform projections. Actual earnings depend on your performance.</p>
      </div>

      {/* Main content: form + calculator */}
      {showForm ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-sm">📢</div>
              <h2 className="text-white font-bold text-lg">Create Your Tipster Profile</h2>
            </div>

            <div>
              <label className="text-white/60 text-xs font-semibold uppercase tracking-wide block mb-2">Display Name *</label>
              <input
                value={form.display_name}
                onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
                placeholder="e.g. PremiumGoals, ValueKing, LaProfessor"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-white/60 text-xs font-semibold uppercase tracking-wide block mb-2">Your Speciality</label>
              <input
                value={form.speciality}
                onChange={e => setForm(p => ({ ...p, speciality: e.target.value }))}
                placeholder="e.g. Premier League Goals, Asian Handicap, BTTS"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-white/60 text-xs font-semibold uppercase tracking-wide block mb-2">Bio</label>
              <textarea
                value={form.bio}
                onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                placeholder="Tell subscribers about your approach and what makes your picks different..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-violet-500 transition-colors resize-none"
              />
            </div>

            <div>
              <label className="text-white/60 text-xs font-semibold uppercase tracking-wide block mb-2">Monthly Subscription Price</label>
              <div className="flex gap-2 mb-3 flex-wrap">
                {PRICE_PRESETS.map(preset => (
                  <button
                    type="button"
                    key={preset.value}
                    onClick={() => setForm(p => ({ ...p, monthly_price: preset.value }))}
                    className={`relative text-sm font-bold px-3 py-1.5 rounded-lg border transition-all ${
                      form.monthly_price === preset.value
                        ? 'bg-violet-600 border-violet-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                    }`}
                  >
                    {preset.label}
                    {preset.popular && form.monthly_price !== preset.value && (
                      <span className="absolute -top-2 -right-1 text-[8px] bg-amber-500 text-black font-black px-1 rounded-full">HOT</span>
                    )}
                  </button>
                ))}
                <input
                  type="number"
                  value={form.monthly_price}
                  onChange={e => setForm(p => ({ ...p, monthly_price: e.target.value }))}
                  min="4.99" max="49.99" step="0.01"
                  required
                  placeholder="Custom"
                  className="w-28 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <p className="text-white/30 text-xs">Min £4.99 · Max £49.99 · Recommended: £9.99–£14.99</p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-sm transition-all shadow-lg shadow-violet-500/20"
            >
              {loading ? 'Creating your profile…' : '🚀 Launch My Tipster Profile'}
            </button>

            <p className="text-white/25 text-xs text-center">
              By applying you agree to post honest, well-reasoned picks. Verified results only.
            </p>
          </form>

          {/* Live earnings calculator */}
          <div className="space-y-4">
            <EarningsCalculator price={form.monthly_price} isFounder={isFounder} />

            {/* Share to recruit */}
            <div className="bg-[#13162b] border border-white/8 rounded-2xl p-4">
              <p className="text-white/60 text-sm font-semibold mb-3">📣 Know other good tipsters? Share this</p>
              <div className="flex gap-2">
                <a
                  href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#1d9bf0]/10 hover:bg-[#1d9bf0]/20 border border-[#1d9bf0]/25 text-[#1d9bf0] text-xs font-bold py-2.5 rounded-xl transition-colors"
                >
                  𝕏 Share on X
                </a>
                <a
                  href={`https://wa.me/?text=${shareText}%20${shareUrl}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-xs font-bold py-2.5 rounded-xl transition-colors"
                >
                  💬 Share on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CTA block when form hidden */
        <div className="text-center">
          <div className="bg-gradient-to-b from-violet-600/10 to-transparent border border-violet-500/20 rounded-2xl p-8 mb-6">
            <EarningsCalculator price="9.99" isFounder={isFounder} />
            <button
              onClick={() => setShowForm(true)}
              className="mt-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-violet-500/25 w-full"
            >
              🚀 Apply as Founding Tipster — It's Free
            </button>
          </div>

          {/* FAQ */}
          <div className="text-left space-y-3 max-w-2xl mx-auto">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest text-center mb-4">Common Questions</p>
            {[
              { q: 'Do I need a big following?', a: 'No. BetIQ brings the audience to you. A verifiable track record is all you need to start attracting subscribers.' },
              { q: 'How are results verified?', a: 'All tips and results are logged on-platform. You can\'t edit results after the match — subscribers can trust what they see.' },
              { q: 'When do I get paid?', a: 'Monthly payouts via bank transfer or PayPal. Minimum withdrawal is £20.' },
              { q: 'What is the 90/10 split?', a: 'Founding tipsters keep 90% of every subscription for the life of the account. Standard tipsters keep 80%.' },
            ].map(faq => (
              <div key={faq.q} className="bg-[#13162b] border border-white/8 rounded-xl p-4">
                <p className="text-white text-sm font-semibold mb-1">{faq.q}</p>
                <p className="text-white/40 text-xs leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
