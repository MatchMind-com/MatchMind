import { Suspense } from 'react'
import PicksClient from '@/components/picks/PicksClient'

/**
 * /dashboard/picks — Phase 3 home for AI picks.
 *
 * Server entry. The auth gate is handled by the dashboard layout, so this
 * route just needs to render the client orchestrator. PicksClient calls
 * useSearchParams (?tab, ?leagues), so it must live under a Suspense
 * boundary for App Router's static optimisation.
 */
export default function PicksPage() {
  return (
    <Suspense fallback={<PicksFallback />}>
      <PicksClient />
    </Suspense>
  )
}

function PicksFallback() {
  return (
    <main className="max-w-5xl mx-auto px-5 lg:px-8 py-6 lg:py-10 space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-24 bg-bg-elevated animate-pulse" />
        <div className="h-10 w-3/4 bg-bg-elevated animate-pulse" />
        <div className="h-4 w-1/2 bg-bg-elevated animate-pulse" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-bg-surface border border-border-subtle h-48 animate-pulse"
          />
        ))}
      </div>
    </main>
  )
}
