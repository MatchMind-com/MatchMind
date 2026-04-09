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
    color: 'border-white/10',
    badge: null,
    features: [
      '✅ Track up to 20 bets/month',
      '✅ Basic win/loss statistics',
      '✅ Manual bet entry',
      '❌ AI Football Coach',
      '❌ Live fixture data',
      '❌ Bankroll tracker',
      '❌ Weekly Report Card',
      '❌ Auto result detection',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '£9.99',
    period: 'per month',
    description: 'For serious bettors',
    color: 'border-violet-500',
    badge: '🔥 Most Popular',
    trial: '7-day free trial',
    features: [
      '✅ Unlimited bet tracking',
      '✅ Full statistics & analytics',
      '✅ AI Football Coach (GPT-4o)',
      '✅ Live fixtures & standings',
      '✅ Bankroll tracker + chart',
      '✅ Weekly AI Report Card',
      '✅ Auto result detection',
      '❌ Kelly Criterion calculator',
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
    price: '£19.99',
    period: 'per month',
    description: 'For professional bettors',
    color: 'border-amber-500',
    badge: '⭐ Best Value',
    trial: '7-day free trial',
    features: [
      '✅ Everything in Pro',
      '✅ Kelly Criterion stake sizing',
      '✅ Advanced pattern detection',
      '✅ Multi-league live data',
      '✅ Priority AI responses',
      '✅ Injury & team news alerts',
      '✅ Export data to CSV',
      '✅ Priority email support',
    ],
  },
]

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
      // Already subscribed — open billing portal to change plan
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url } = await res.json()
      window.location.href = url
      return
    }

    const res = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: planId }),
    })
    const { url, error } = await res.json()
    if (error) { alert(error); setLoading(null); return }
    window.location.href = url
  }

  async function handleManage() {
    setLoading('manage')
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const { url } = await res.json()
    window.location.href = url
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Billing & Plans</h1>
        <p className="text-gray-400 text-sm">
          {tier === 'free'
            ? 'Upgrade to unlock the full power of MatchMind'
            : `You're on the ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan${periodEnd ? ` — renews ${periodEnd}` : ''}`}
        </p>
      </div>

      {/* Current plan banner */}
      {tier !== 'free' && (
        <div className="mb-6 p-4 rounded-xl bg-violet-600/10 border border-violet-500/30 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white">
              {tier.charAt(0).toUpperCase() + tier.slice(1)} Plan
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                status === 'trialing' ? 'bg-amber-500/20 text-amber-300' :
                status === 'active' ? 'bg-emerald-500/20 text-emerald-300' :
                'bg-red-500/20 text-red-300'
              }`}>
                {status === 'trialing' ? '🎁 Trial' : status === 'active' ? '✅ Active' : status}
              </span>
            </div>
            {periodEnd && <div className="text-xs text-gray-400 mt-0.5">Next billing: {periodEnd}</div>}
          </div>
          <button
            onClick={handleManage}
            disabled={loading === 'manage'}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-sm text-white rounded-lg border border-white/10 transition-colors"
          >
            {loading === 'manage' ? 'Loading...' : 'Manage Subscription'}
          </button>
        </div>
      )}

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === tier
          const isPopular = plan.id === 'pro'

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-6 flex flex-col ${plan.color} ${
                isCurrent ? 'bg-white/5' : 'bg-[#12121F]'
              }`}
            >
              {plan.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full ${
                  plan.id === 'pro' ? 'bg-violet-600 text-white' : 'bg-amber-500 text-black'
                }`}>
                  {plan.badge}
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="mt-1">
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  <span className="text-gray-400 text-sm ml-1">/{plan.period}</span>
                </div>
                {plan.trial && (
                  <div className="mt-1 text-xs text-emerald-400 font-medium">🎁 {plan.trial}</div>
                )}
                <p className="text-gray-400 text-xs mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className={`text-xs ${f.startsWith('✅') ? 'text-gray-200' : 'text-gray-500'}`}>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent || loading === plan.id}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isCurrent
                    ? 'bg-white/5 text-gray-400 cursor-default'
                    : plan.id === 'pro'
                    ? 'bg-violet-600 hover:bg-violet-500 text-white'
                    : plan.id === 'elite'
                    ? 'bg-amber-500 hover:bg-amber-400 text-black'
                    : 'bg-white/5 text-gray-400 cursor-default'
                }`}
              >
                {loading === plan.id
                  ? 'Loading...'
                  : isCurrent
                  ? '✓ Current Plan'
                  : plan.id === 'free'
                  ? 'Free Forever'
                  : `Start 7-Day Trial →`}
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-500 mt-6">
        All payments secured by Stripe · Cancel anytime · No hidden fees
      </p>
    </div>
  )
}
