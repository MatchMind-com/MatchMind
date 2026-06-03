'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Goal {
  starting_bankroll: number
  current_bankroll: number
  target: number
  end_date: string
  risk_level: 'conservative' | 'balanced' | 'aggressive'
}

interface Plan {
  daysRemaining: number
  progressPct: number
  onTrack: boolean
}

/* ────────────────────────────────────────────────────────────
 * Inline SVG circular progress ring
 * ──────────────────────────────────────────────────────────── */
function ProgressRing({ pct, label }: { pct: number; label: string }) {
  const size = 140
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clampedPct = Math.max(0, Math.min(100, pct))
  const dashOffset = c - (clampedPct / 100) * c

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-elevated)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      {/* Centre label */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-stat text-3xl font-bold text-fg leading-none">{label}</span>
      </div>
    </div>
  )
}

function fmtMoney(n: number): string {
  const abs = Math.abs(n)
  return `£${abs.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
}

/* ────────────────────────────────────────────────────────────
 * GoalRing — Active Dream Bet goal card
 * ──────────────────────────────────────────────────────────── */
export default function GoalRing({ onProgressChange }: { onProgressChange?: (pct: number | null) => void }) {
  const [goal, setGoal] = useState<Goal | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch('/api/dream-bet', { cache: 'no-store' })
        if (!res.ok) throw new Error('bad status')
        const json = await res.json()
        if (!cancelled) {
          setGoal(json.goal ?? null)
          setPlan(json.plan ?? null)
          onProgressChange?.(json.plan?.progressPct ?? null)
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    // Poll on the same cadence as BankrollHero so goal progress updates
    // after the live evaluator auto-settles bets in the background.
    const poll = setInterval(() => load(), 90_000)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      clearInterval(poll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Loading skeleton
  if (loading && !goal) {
    return (
      <div className="card animate-pulse flex flex-col items-center">
        <div className="self-start h-3 w-24 bg-bg-elevated mb-4" />
        <div className="w-[140px] h-[140px] bg-bg-elevated" />
        <div className="h-4 w-32 bg-bg-elevated mt-4" />
        <div className="h-3 w-20 bg-bg-elevated mt-2" />
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <div className="card">
        <p className="eyebrow">Active Goal</p>
        <p className="text-fg-muted text-xs mt-2">Couldn&apos;t load your goal.</p>
      </div>
    )
  }

  // No active goal — warm CTA
  if (!goal) {
    return (
      <div className="card flex flex-col items-center text-center justify-center min-h-[230px]">
        <p className="eyebrow self-start">Active Goal</p>
        <div className="flex-1 flex flex-col items-center justify-center py-2">
          <p className="text-fg text-base font-semibold mb-1">No goal set yet</p>
          <p className="text-fg-secondary text-xs max-w-[220px] leading-relaxed">
            Pick a target, a deadline, and a risk level. We&apos;ll plan the path.
          </p>
        </div>
        <Link
          href="/dashboard/dream-bet"
          className="btn-primary text-sm w-full text-center mt-3"
        >
          Set a goal →
        </Link>
      </div>
    )
  }

  const pct = plan?.progressPct ?? 0
  const onTrack = plan?.onTrack ?? false
  const days = plan?.daysRemaining ?? 0

  return (
    <Link
      href="/dashboard/dream-bet"
      className="card flex flex-col items-center text-center hover:border-border-strong transition-colors duration-200 group"
    >
      <div className="w-full flex items-center justify-between mb-2">
        <p className="eyebrow">Active Goal</p>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border ${
            onTrack
              ? 'bg-success/10 text-success border-success/30'
              : 'bg-loss/10 text-loss border-loss/30'
          }`}
        >
          {onTrack ? 'On track' : 'Behind pace'}
        </span>
      </div>

      <ProgressRing pct={pct} label={`${Math.round(pct)}%`} />

      <p className="font-stat text-fg text-base font-semibold mt-4 tracking-tight">
        {fmtMoney(goal.current_bankroll)} <span className="text-fg-muted">→</span> {fmtMoney(goal.target)}
      </p>
      <p className="text-fg-secondary text-xs mt-1">
        {days > 0 ? `${days} day${days === 1 ? '' : 's'} remaining` : 'Goal deadline reached'}
      </p>
    </Link>
  )
}
