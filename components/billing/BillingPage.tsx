'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '£0',
    period: 'forever',
    description: 'Get started with the basics',
    features: [
      { text: 'Track up to 10 bets', included: true },
      { text: 'Basic win/loss statistics', included: true },
      { text: 'Manual bet entry', included: true },
      { text: '3 AI predictions daily', included: true },
      { text: 'AI Football Coach', included: false },
      { text: 'Full predictions + value bets', included: false },
      { text: 'Bankroll tracker', included: false },
      { text: 'Weekly AI Report Card', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '£9.99',
    period: 'per month',
    description: 'Everything you need to bet smarter',
    badge: '7-Day Free Trial',
    trial: '7-day free trial',
    features: [
      { text: 'Unlimited bet tracking', included: true },
      { text: 'Full AI predictions (10+ leagues daily)', included: true },
      { text: 'Pinnacle value bet finder + EV scores', included: true },
      { text: 'Real Bet365 odds comparison', included: true },
      { text: 'Daily AI accumulator builder', included: true },
      { text: 'AI Football Coach (GPT-4o)', included: true },
      { text: 'Bankroll tracker + P&L chart', included: true },
      { text: 'Full leaderboard access', included: true },
    ],
  },
]

function CheckIcon({ size = 'sm' }: { size?: 'sm' | 'xs' }) {
  const cls = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export default function BillingPage({ profile }: { profile: any }) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  const tier = profile?.subscription_tier || 'free'
  const status = profile?.subscription_status
  const periodEnd = profile?.subscription_current_period_end
    ? new Date(profile.subscription_current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  async function handleUpgrade(planId: string) {
    if (planId === 'free' || planId === tier) return
    setLoading(planId)

    if (profile?.stripe_customer_id && tier !== 'free') {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url } = await res.json()
      window.location.href = url
      return
    }

    window.location.href = `/api/stripe/create-checkout?plan=${planId}`
  }

  async function handleManage() {
    setLoading('manage')
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const { url } = await res.json()
    window.location.href = url
  }

  return (
    <div className="p-5 lg:p-7 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="text-slate-500 text-xs uppercase tracking-widest mb-1 font-medium">Account</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Billing & Plans</h1>
        <p className="text-slate-500 text-sm mt-1">
          {tier === 'free'
            ? 'Upgrade to unlock the full power of MatchMind'
            : `You're on the ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan${periodEnd ? ` — renews ${periodEnd}` : ''}`}
        </p>
      </div>

      {/* Active plan banner */}
      {tier !== 'free' && (
        <div className="p-5 rounded-2xl bg-[#0E1628] border border-blue-500/25 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-bold text-white">{tier.charAt(0).toUpperCase() + tier.slice(1)} Plan</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                status === 'trialing' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/25' :
                status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25' :
                'bg-red-500/20 text-red-300 border border-red-500/25'
              }`}>
                {status === 'trialing' ? 'Trial' : status === 'active' ? 'Active' : status}
              </span>
            </div>
            {periodEnd && <div className="text-xs text-slate-500">Next billing: {periodEnd}</div>}
          </div>
          <button
            onClick={handleManage}
            disabled={loading === 'manage'}
            className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.07] text-sm font-semibold text-white rounded-xl border border-white/[0.07] transition-colors"
          >
            {loading === 'manage' ? 'Loading…' : 'Manage Subscription'}
          </button>
        </div>
      )}

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === tier
          const isPro = plan.id === 'pro'

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 flex flex-col border transition-all ${
                isPro
                  ? 'bg-[#0E1628] border-blue-500/30'
                  : 'bg-[#0E1628] border-white/[0.07]'
              }`}
            >
              {/* Popular badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-black px-3 py-1 rounded-full bg-blue-600 text-white uppercase tracking-wide whitespace-nowrap">
                  {plan.badge}
                </div>
              )}

              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-black text-white tracking-tight">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/[0.1]">
                      Current
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  <span className="text-slate-500 text-sm ml-1">/{plan.period}</span>
                </div>
                {plan.trial && (
                  <div className="mt-1.5 text-xs text-emerald-400 font-semibold">{plan.trial} included</div>
                )}
                <p className="text-slate-500 text-xs mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-xs">
                    <span className={`flex-shrink-0 ${f.included ? 'text-emerald-400' : 'text-slate-700'}`}>
                      {f.included ? <CheckIcon /> : <XIcon />}
                    </span>
                    <span className={f.included ? 'text-slate-300' : 'text-slate-600'}>{f.text}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent || loading === plan.id}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                  isCurrent
                    ? 'bg-white/[0.04] text-slate-500 cursor-default border border-white/[0.07]'
                    : isPro
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-white/[0.04] text-slate-500 cursor-default border border-white/[0.07]'
                }`}
              >
                {loading === plan.id
                  ? 'Loading…'
                  : isCurrent
                  ? '✓ Current Plan'
                  : plan.id === 'free'
                  ? 'Free Forever'
                  : 'Start 7-Day Free Trial →'}
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-slate-600">
        All payments secured by Stripe · Cancel anytime · No hidden fees
      </p>
    </div>
  )
}
