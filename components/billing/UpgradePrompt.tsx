'use client'
import { useRouter } from 'next/navigation'

export default function UpgradePrompt({ feature, requiredTier = 'pro' }: { feature: string; requiredTier?: 'pro' | 'elite' }) {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-violet-950/30 to-transparent rounded-xl border border-violet-500/20">
      <div className="text-3xl mb-3">🔒</div>
      <h3 className="text-white font-semibold mb-1">{feature}</h3>
      <p className="text-gray-400 text-sm mb-4">
        This feature is available on the {requiredTier === 'elite' ? 'Elite' : 'Pro'} plan.
        <br />Start your 7-day free trial today.
      </p>
      <button
        onClick={() => router.push('/dashboard/billing')}
        className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Upgrade to {requiredTier === 'elite' ? 'Elite' : 'Pro'} →
      </button>
    </div>
  )
}
