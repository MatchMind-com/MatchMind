'use client'

/**
 * EmailCapture — the conversion control on /world-cup.
 *
 * Posts to /api/subscribe with source='world-cup' so we can attribute
 * WC-ramp signups separately from general site captures (Alp's admin
 * dashboard already segments by source).
 *
 * Optimistic UI: as soon as the form submits, lock the input and show
 * the success state. If the server errors we show the message and
 * unlock so the user can retry. No third-party form lib — Resend +
 * Supabase do the rest server-side.
 */

import { useState } from 'react'

type Status = 'idle' | 'submitting' | 'success' | 'error'

export default function EmailCapture() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'submitting' || status === 'success') return
    const trimmed = email.trim().toLowerCase()
    if (!trimmed.includes('@')) {
      setError('Please enter a valid email.')
      setStatus('error')
      return
    }
    setStatus('submitting')
    setError(null)
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'world-cup' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || 'Something went wrong. Try again in a moment.')
        setStatus('error')
        return
      }
      setStatus('success')
    } catch {
      setError('Network error. Check connection and try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="max-w-lg">
        <div className="flex items-start gap-3 p-5 rounded-2xl border border-success/30 bg-success/5">
          <span className="text-success text-2xl leading-none mt-0.5">✓</span>
          <div>
            <p className="text-fg font-bold text-base mb-1">You&apos;re on the list.</p>
            <p className="text-fg-secondary text-sm">
              First email lands the morning of June 11. Check your inbox for a confirmation now.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg" noValidate>
      <div className="flex flex-col sm:flex-row gap-3">
        <label className="sr-only" htmlFor="wc-email">Email address</label>
        <input
          id="wc-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status === 'error') {
              setStatus('idle')
              setError(null)
            }
          }}
          disabled={status === 'submitting'}
          placeholder="you@example.com"
          className="flex-1 min-w-0 bg-bg-surface border border-border-subtle focus:border-brand rounded-xl px-4 py-3.5 text-fg text-base placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="bg-brand hover:bg-brand-hover text-white font-bold px-6 py-3.5 rounded-xl transition-colors disabled:opacity-70 whitespace-nowrap"
        >
          {status === 'submitting' ? 'Signing up…' : 'Get free WC picks'}
        </button>
      </div>
      {status === 'error' && error && (
        <p className="mt-2 text-loss text-sm">{error}</p>
      )}
    </form>
  )
}
