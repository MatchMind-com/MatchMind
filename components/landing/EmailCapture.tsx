'use client'

import { useState } from 'react'

export default function EmailCapture() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()

      if (data.success) {
        setStatus('success')
      } else {
        setStatus('error')
        setErrorMsg(data.error || 'Something went wrong')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Network error — please try again')
    }
  }

  if (status === 'success') {
    return (
      <section className="py-6 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-6 py-5 flex items-center gap-4">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-emerald-300 font-bold text-sm">You&apos;re in! Check your inbox.</p>
              <p className="text-white/40 text-xs mt-0.5">Today&apos;s top value bets are on their way — plus every morning from now on.</p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-r from-emerald-600/10 to-teal-600/5 border border-emerald-500/25 rounded-2xl px-6 py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-white font-bold text-sm mb-0.5">
                ⚡ Get today&apos;s top 3 value bets — free, every morning
              </p>
              <p className="text-white/40 text-xs">Real AI picks straight to your inbox. No spam, unsubscribe anytime.</p>
            </div>
            <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 sm:w-52 bg-white/5 border border-white/15 text-white text-sm placeholder:text-white/25 px-3.5 py-2.5 rounded-xl outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-all"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all whitespace-nowrap shadow-lg shadow-emerald-500/20"
              >
                {status === 'loading' ? '...' : 'Send me picks'}
              </button>
            </form>
          </div>
          {status === 'error' && (
            <p className="text-red-400 text-xs mt-3">{errorMsg}</p>
          )}
        </div>
      </div>
    </section>
  )
}
