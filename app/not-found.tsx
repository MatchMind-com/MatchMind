import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0B0B14] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-violet-500/30">
            B
          </div>
        </div>

        {/* Error code */}
        <p className="text-8xl font-black bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent mb-2">
          404
        </p>

        <h1 className="text-2xl font-black text-white mb-3">
          This page doesn&apos;t exist
        </h1>

        <p className="text-white/40 text-base leading-relaxed mb-10">
          The page you&apos;re looking for may have been moved, deleted, or never existed.
          Let&apos;s get you back on track.
        </p>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 mb-8 max-w-sm mx-auto">
          {[
            { label: '🏠 Dashboard', href: '/dashboard' },
            { label: '🔮 Predictions', href: '/dashboard/predictions' },
            { label: '📊 Statistics', href: '/dashboard/statistics' },
            { label: '🏆 Leaderboard', href: '/dashboard/leaderboard' },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl py-3 px-4 text-white/60 hover:text-white text-sm font-medium transition-all"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Primary CTA */}
        <Link
          href="/"
          className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-violet-500/25 hover:-translate-y-0.5"
        >
          ← Back to Home
        </Link>

        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      </div>
    </div>
  )
}
