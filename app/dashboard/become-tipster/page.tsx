'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

  const price = parseFloat(form.monthly_price) || 0
  const yourCut = (price * 0.8).toFixed(2)

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
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
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={form.monthly_price}
              onChange={e => setForm(p => ({ ...p, monthly_price: e.target.value }))}
              min="4.99" max="49.99" step="0.01"
              required
              className="w-36 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
            />
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <p className="text-emerald-400 text-sm font-bold">You earn: £{yourCut}/subscriber/mo</p>
              <p className="text-white/30 text-xs">20% platform fee applied</p>
            </div>
          </div>
          <p className="text-white/30 text-xs mt-1">Min £4.99 · Max £49.99</p>
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
    </div>
  )
}
