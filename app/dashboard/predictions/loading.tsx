export default function PredictionsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-white/8 rounded-xl mb-2" />
          <div className="h-4 w-72 bg-white/5 rounded-lg" />
        </div>
        <div className="h-9 w-32 bg-white/8 rounded-xl" />
      </div>

      {/* Stats bar skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-[#12121F] border border-white/8 rounded-2xl p-4">
            <div className="h-3 w-16 bg-white/8 rounded mb-3" />
            <div className="h-6 w-10 bg-white/10 rounded" />
          </div>
        ))}
      </div>

      {/* Prediction cards skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className="bg-[#12121F] border border-white/8 rounded-2xl p-5"
          >
            <div className="flex items-start justify-between mb-4">
              {/* Match info */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-3 w-20 bg-white/8 rounded" />
                  <div className="h-3 w-1 bg-white/5 rounded" />
                  <div className="h-3 w-16 bg-white/5 rounded" />
                </div>
                <div className="h-5 w-56 bg-white/10 rounded-lg mb-1" />
                <div className="h-3 w-32 bg-white/5 rounded" />
              </div>

              {/* EV badge */}
              <div className="h-8 w-16 bg-emerald-500/10 border border-emerald-500/15 rounded-xl" />
            </div>

            <div className="flex items-center gap-3">
              {/* Bet type badge */}
              <div className="h-7 w-24 bg-violet-500/10 border border-violet-500/15 rounded-lg" />

              {/* Odds */}
              <div className="h-5 w-20 bg-white/8 rounded" />

              {/* Probability bar */}
              <div className="ml-auto flex items-center gap-2">
                <div className="w-20 h-1.5 rounded-full bg-white/8" />
                <div className="h-3 w-8 bg-white/5 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* "Powered by" footer skeleton */}
      <div className="flex justify-center">
        <div className="h-4 w-48 bg-white/5 rounded" />
      </div>
    </div>
  )
}
