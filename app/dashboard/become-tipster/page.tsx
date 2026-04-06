'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PRICE_PRESETS = [
  { label: '£4.99', value: '4.99' },
  { label: '£9.99', value: '9.99' },
  { label: '£14.99', value: '14.99' },
  { label: '£19.99', value: '19.99' },
]

function EarningsCalculator({ price }: { price: string }) {
  const [subs, setSubs] = useState(50)
  const p = parseFloat(price) || 9.99
  const cut = p * 0.8
  const monthly = cut * subs
  const annual = monthly * 12

  return (
    <div className="bg-[#0B0B14] border border-white/10 rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">💰</span>
        <p className="text-white font-semibold text-sm">Earnings Calculator</p>
      </div>

      {/* Subscriber slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-white/50 text-xs">Subscribers</label>
          <span className="text-white font-bold text-sm">{subs}</span>
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

      {/* Revenue rows */}
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-white/[0.03] rounded-xl px-4 py-3">
          <div>
            <p className="text-white/50 text-xs">Monthly revenue</p>
            <p className="text-white/30 text-[10px] mt-0.5">{subs} subs × £{cut.toFixed(2)} your cut</p>
          </div>
          <p className="text-emerald-400 font-black text-xl">£{monthly.toFixed(0)}</p>
        </div>
        <div className="flex items-center justify-between bg-emerald-500/8 border border-emerald-500/15 rounded-xl px-4 py-3">
          <div>
            <p className="text-white/60 text-xs">Annual revenue</p>
            <p className="text-white/30 text-[10px] mt-0.5">12 months at same rate</p>
          </div>
          <p className="text-emerald-300 font-black text-2xl">£{annual.toFixed(0)}</p>
        </div>
      </div>

      {/* Breakdown note */}
      <p className="text-white/25 text-[10px] text-center">
        £{p.toFixed(2)} price × 80% your cut = £{cut.toFixed(2)} per subscriber per month. 20% platform fee.
      </p>
    </div>
  )
}

export default function BecomeTipsterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ display_name: '', bio: '', speciality: '', monthly_price: '9.99' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    router.push(`/dashboard/my-tipster`)
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl">🏆</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Become a Tipster</h1>
          <p className="text-white/40 text-sm">Share your picks and earn from subscribers</p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl p-5 mb-8">
        <p className="text-violet-300 font-semibold text-sm mb-3">How it works</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { icon: '📢', title: 'Post Tips', desc: 'Share free teasers + premium picks' },
            { icon: '👥', title: 'Build Following', desc: 'Subscribers pay monthly to access your tips' },
            { icon: '💰', title: 'Earn 80%', desc: 'We take 20%, you keep the rest' },
          ].map(s => (
            <div key={s.title}>
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-white text-xs font-semibold">{s.title}</p>
              <p className="text-white/40 text-[10px] mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wide block mb-2">Display Name *</label>
            <input
              value={form.display_name}
              onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
              placeholder="e.g. PremiumGoals"
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wide block mb-2">Speciality</label>
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
              placeholder="Tell subscribers about your betting approach and expertise..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wide block mb-2">Monthly Subscription Price (£)</label>
            {/* Quick-select presets */}
            <div className="flex gap-2 mb-3 flex-wrap">
              {PRICE_PRESETS.map(preset => (
                <button
                  type="button"
                  key={preset.value}
                  onClick={() => setForm(p => ({ ...p, monthly_price: preset.value }))}
                  className={`text-sm font-bold px-3 py-1.5 rounded-lg border transition-all ${
                    form.monthly_price === preset.value
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  {preset.label}
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
            <p className="text-white/30 text-xs">Min £4.99 · Max £49.99</p>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-sm transition-colors"
          >
            {loading ? 'Creating your profile…' : '🚀 Launch My Tipster Profile'}
          </button>
        </form>

        {/* Live earnings calculator */}
        <div className="space-y-4">
          <EarningsCalculator price={form.monthly_price} />

          {/* Social proof */}
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4">
            <p className="text-amber-300 font-semibold text-sm mb-2">🔥 Founding Tipster Perks</p>
            <div className="space-y-1.5">
              {[
                '🏆 Featured placement at the top of the marketplace',
                '💰 0% commission for your first 3 months',
                '⚡ Priority onboarding support',
                '📢 Founding Tipster badge on your profile',
              ].map(perk => (
                <p key={perk} className="text-white/50 text-xs">{perk}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
