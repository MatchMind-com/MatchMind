'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Tipster {
  id: string
  display_name: string
  bio: string
  speciality: string
  monthly_price: number
  total_tips: number
  wins: number
  losses: number
  win_rate: number
  roi: number
  total_profit: number
  avg_odds: number
  subscribers: number
}

function StatPill({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-bold ${positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-white'}`}>{value}</p>
      <p className="text-white/30 text-[10px]">{label}</p>
    </div>
  )
}

function RoiBadge({ roi }: { roi: number }) {
  const isPositive = roi >= 0
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
      roi >= 15 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
      roi >= 0  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  'bg-red-500/10 text-red-400 border-red-500/20'
    }`}>
      {isPositive ? '+' : ''}{roi}% ROI
    </span>
  )
}

export default function MarketplacePage() {
  const [tipsters, setTipsters] = useState<Tipster[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'roi' | 'winrate' | 'tips' | 'price'>('roi')

  useEffect(() => {
    fetch('/api/tipsters')
      .then(r => r.json())
      .then(d => setTipsters(d.tipsters || []))
      .finally(() => setLoading(false))
  }, [])

  const sorted = [...tipsters].sort((a, b) => {
    if (filter === 'roi') return b.roi - a.roi
    if (filter === 'winrate') return b.win_rate - a.win_rate
    if (filter === 'tips') return b.total_tips - a.total_tips
    if (filter === 'price') return a.monthly_price - b.monthly_price
    return 0
  })

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl">🛒</div>
          <div>
            <h1 className="text-2xl font-bold text-white">Tipster Marketplace</h1>
            <p className="text-white/40 text-sm">Subscribe to verified tipsters with proven track records</p>
          </div>
        </div>
        <Link
          href="/dashboard/become-tipster"
          className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          + Become a Tipster
        </Link>
      </div>

      {/* Sort filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {[
          { key: 'roi', label: '📈 Best ROI' },
          { key: 'winrate', label: '🎯 Win Rate' },
          { key: 'tips', label: '📊 Most Tips' },
          { key: 'price', label: '💰 Lowest Price' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              filter === f.key
                ? 'bg-violet-600/30 text-violet-300 border-violet-500/50'
                : 'bg-white/5 text-white/50 border-white/10 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white/5 rounded-2xl h-48 animate-pulse border border-white/5" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && tipsters.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-white font-bold text-lg mb-2">No tipsters yet</p>
          <p className="text-white/40 text-sm mb-6">Be the first to share your picks and build a following</p>
          <Link href="/dashboard/become-tipster" className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
            Become the First Tipster
          </Link>
        </div>
      )}

      {/* Tipster cards */}
      {!loading && sorted.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((tipster, i) => (
            <Link
              key={tipster.id}
              href={`/dashboard/tipsters/${tipster.id}`}
              className="group bg-[#13162b] border border-white/8 rounded-2xl p-5 hover:border-violet-500/40 transition-all hover:bg-[#15183a]"
            >
              {/* Top row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-violet-500/20">
                    {tipster.display_name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold">{tipster.display_name}</p>
                      {i === 0 && <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-semibold">#1</span>}
                    </div>
                    {tipster.speciality && <p className="text-white/40 text-xs">{tipster.speciality}</p>}
                  </div>
                </div>
                <RoiBadge roi={tipster.roi} />
              </div>

              {/* Bio */}
              {tipster.bio && (
                <p className="text-white/50 text-xs mb-4 line-clamp-2">{tipster.bio}</p>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3 mb-4 bg-white/3 rounded-xl p-3">
                <StatPill label="Win Rate" value={`${tipster.win_rate}%`} positive={tipster.win_rate >= 50} />
                <StatPill label="Tips" value={String(tipster.total_tips)} />
                <StatPill label="Avg Odds" value={tipster.avg_odds > 0 ? tipster.avg_odds.toFixed(2) : '—'} />
                <StatPill label="Profit" value={`${tipster.total_profit >= 0 ? '+' : ''}${tipster.total_profit}u`} positive={tipster.total_profit >= 0} />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-white/30 text-xs">
                  <span>👥</span>
                  <span>{tipster.subscribers} subscriber{tipster.subscribers !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-sm">£{tipster.monthly_price}/mo</span>
                  <span className="bg-violet-600/20 text-violet-300 border border-violet-500/30 text-xs font-semibold px-3 py-1 rounded-lg group-hover:bg-violet-600/40 transition-colors">
                    Subscribe →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-center text-white/20 text-xs mt-8">
        Platform fee of 20% applies. Tips are for educational purposes. Always bet responsibly.
      </p>
    </div>
  )
}
