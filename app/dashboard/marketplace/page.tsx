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
  is_demo?: boolean
}

const DEMO_TIPSTERS: Tipster[] = [
  {
    id: 'demo1', display_name: 'ValueKing_88', speciality: 'Premier League Value Bets',
    bio: '6 years tracking value bets in the PL. Focus on under-priced away wins and Asian handicap edges. +24% ROI over 142 tips.',
    monthly_price: 12.99, total_tips: 142, wins: 87, losses: 55, win_rate: 61,
    roi: 24.3, total_profit: 38.4, avg_odds: 2.1, subscribers: 47, is_demo: true,
  },
  {
    id: 'demo2', display_name: 'AccaHunter', speciality: 'BTTS & Over Goals',
    bio: 'Specialising in BTTS and over 2.5 across Europe. Consistent +EV selections based on xG data and team form.',
    monthly_price: 9.99, total_tips: 98, wins: 58, losses: 40, win_rate: 59,
    roi: 18.7, total_profit: 22.1, avg_odds: 1.82, subscribers: 31, is_demo: true,
  },
  {
    id: 'demo3', display_name: 'EVEdge_Pro', speciality: 'Multi-League EV Finder',
    bio: 'Pure expected value methodology across 8 leagues. Every tip has a documented edge over bookmaker odds.',
    monthly_price: 14.99, total_tips: 210, wins: 118, losses: 92, win_rate: 56,
    roi: 14.2, total_profit: 48.7, avg_odds: 1.95, subscribers: 83, is_demo: true,
  },
]

function StatPill({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-bold ${positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-white'}`}>{value}</p>
      <p className="text-white/30 text-[10px]">{label}</p>
    </div>
  )
}

function RoiBadge({ roi }: { roi: number }) {
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
      roi >= 15 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
      roi >= 0  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  'bg-red-500/10 text-red-400 border-red-500/20'
    }`}>
      {roi >= 0 ? '+' : ''}{roi}% ROI
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
      .then(d => {
        const real = d.tipsters || []
        setTipsters(real.length > 0 ? real : DEMO_TIPSTERS)
      })
      .catch(() => setTipsters(DEMO_TIPSTERS))
      .finally(() => setLoading(false))
  }, [])

  const isShowingDemo = tipsters.length > 0 && tipsters[0]?.is_demo

  const sorted = [...tipsters].sort((a, b) => {
    if (filter === 'roi') return b.roi - a.roi
    if (filter === 'winrate') return b.win_rate - a.win_rate
    if (filter === 'tips') return b.total_tips - a.total_tips
    if (filter === 'price') return a.monthly_price - b.monthly_price
    return 0
  })

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl">🛒</div>
          <div>
            <h1 className="text-2xl font-bold text-white">Tipster Marketplace</h1>
            <p className="text-white/40 text-sm">Subscribe to verified tipsters with proven track records</p>
          </div>
        </div>
        <Link href="/dashboard/become-tipster" className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors">
          + Become a Tipster
        </Link>
      </div>

      {!loading && isShowingDemo && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <span className="text-lg mt-0.5">🌱</span>
          <div>
            <p className="text-amber-300 font-semibold text-sm">Marketplace launching — example tipsters shown</p>
            <p className="text-white/40 text-xs mt-0.5">
              Real tipsters are joining. Want to be one of the first? Set up your profile and start earning from your picks.
            </p>
            <Link href="/dashboard/become-tipster" className="inline-block mt-2 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors">
              Become a tipster →
            </Link>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {([['roi','📈 Best ROI'],['winrate','🎯 Win Rate'],['tips','📊 Most Tips'],['price','💰 Lowest Price']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${filter === key ? 'bg-violet-600/30 text-violet-300 border-violet-500/50' : 'bg-white/5 text-white/50 border-white/10 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2,3,4].map(i => <div key={i} className="bg-white/5 rounded-2xl h-48 animate-pulse border border-white/5" />)}
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((tipster, i) => (
            <div key={tipster.id}
              className={`group bg-[#13162b] border border-white/8 rounded-2xl p-5 transition-all ${!tipster.is_demo ? 'hover:border-violet-500/40 hover:bg-[#15183a] cursor-pointer' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-violet-500/20">
                    {tipster.display_name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold">{tipster.display_name}</p>
                      {i === 0 && <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-semibold">#1</span>}
                      {tipster.is_demo && <span className="text-[10px] text-white/25 border border-white/10 rounded px-1 font-normal">demo</span>}
                    </div>
                    {tipster.speciality && <p className="text-white/40 text-xs">{tipster.speciality}</p>}
                  </div>
                </div>
                <RoiBadge roi={tipster.roi} />
              </div>
              {tipster.bio && <p className="text-white/50 text-xs mb-4 line-clamp-2">{tipster.bio}</p>}
              <div className="grid grid-cols-4 gap-3 mb-4 bg-white/3 rounded-xl p-3">
                <StatPill label="Win Rate" value={`${tipster.win_rate}%`} positive={tipster.win_rate >= 50} />
                <StatPill label="Tips" value={String(tipster.total_tips)} />
                <StatPill label="Avg Odds" value={tipster.avg_odds > 0 ? tipster.avg_odds.toFixed(2) : '—'} />
                <StatPill label="Profit" value={`${tipster.total_profit >= 0 ? '+' : ''}${tipster.total_profit}u`} positive={tipster.total_profit >= 0} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-white/30 text-xs">
                  <span>👥</span>
                  <span>{tipster.subscribers} subscriber{tipster.subscribers !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-sm">£{tipster.monthly_price}/mo</span>
                  {!tipster.is_demo ? (
                    <span className="bg-violet-600/20 text-violet-300 border border-violet-500/30 text-xs font-semibold px-3 py-1 rounded-lg group-hover:bg-violet-600/40 transition-colors">
                      Subscribe →
                    </span>
                  ) : (
                    <Link href="/dashboard/become-tipster" className="bg-violet-600/10 text-violet-400/60 border border-violet-500/20 text-xs font-semibold px-3 py-1 rounded-lg">
                      Be like this →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-white/20 text-xs mt-8">Platform fee of 20% applies. Tips are for educational purposes. Always bet responsibly.</p>
    </div>
  )
}
