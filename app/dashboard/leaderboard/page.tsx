'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  total_bets: number
  wins: number
  losses: number
  win_rate: number
  roi: number
  total_pnl: number
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>
  if (rank === 2) return <span className="text-2xl">🥈</span>
  if (rank === 3) return <span className="text-2xl">🥉</span>
  return (
    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
      <span className="text-white/50 text-xs font-bold">#{rank}</span>
    </div>
  )
}

function RoiChip({ roi }: { roi: number }) {
  const positive = roi >= 0
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${positive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
      {positive ? '+' : ''}{roi}%
    </span>
  )
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'elite'>('free')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id)
        supabase.from('profiles').select('subscription_tier').eq('user_id', user.id).single()
          .then(({ data }) => {
            if (data?.subscription_tier) setSubscriptionTier(data.subscription_tier as 'free' | 'pro' | 'elite')
          })
      }
    })

    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => {
        if (d.success) setLeaderboard(d.leaderboard || [])
        else setError(d.error || 'Failed to load leaderboard')
      })
      .catch(() => setError('Failed to load leaderboard'))
      .finally(() => setLoading(false))
  }, [])

  const myRank = leaderboard.find(e => e.user_id === currentUserId)
  const visibleEntries = subscriptionTier === 'free' ? leaderboard.slice(0, 5) : leaderboard
  const lockedCount = leaderboard.length - visibleEntries.length

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl">🏆</div>
          <div>
            <h1 className="text-2xl font-bold text-white">Community Leaderboard</h1>
            <p className="text-white/40 text-sm">Top tipsters ranked by ROI · Min. 5 settled bets</p>
          </div>
        </div>
      </div>

      {/* My rank card (if on board) */}
      {!loading && myRank && (
        <div className="bg-violet-600/10 border border-violet-500/30 rounded-2xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RankBadge rank={myRank.rank} />
            <div>
              <p className="text-white/50 text-xs">Your ranking</p>
              <p className="text-white font-bold">#{myRank.rank} of {leaderboard.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-white/40 text-xs">Win Rate</p>
              <p className="text-white font-bold">{myRank.win_rate}%</p>
            </div>
            <div>
              <p className="text-white/40 text-xs">ROI</p>
              <RoiChip roi={myRank.roi} />
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="bg-white/5 rounded-2xl h-16 animate-pulse border border-white/5" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
          <p className="text-red-400">⚠️ {error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && leaderboard.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">🌱</p>
          <p className="text-white font-bold mb-2">Leaderboard is warming up</p>
          <p className="text-white/50 text-sm">Users need at least 5 settled bets to appear. Be the first!</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && leaderboard.length > 0 && (
        <div className="bg-[#13162b] border border-white/8 rounded-2xl overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-white/5">
            <span className="text-white/30 text-xs font-semibold w-8">#</span>
            <span className="text-white/30 text-xs font-semibold">Tipster</span>
            <span className="text-white/30 text-xs font-semibold text-right">Bets</span>
            <span className="text-white/30 text-xs font-semibold text-right">Win %</span>
            <span className="text-white/30 text-xs font-semibold text-right">ROI</span>
            <span className="text-white/30 text-xs font-semibold text-right">P&L</span>
          </div>

          {visibleEntries.map((entry, idx) => {
            const isMe = entry.user_id === currentUserId
            const isTop3 = entry.rank <= 3
            return (
              <div
                key={entry.user_id}
                className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-4 transition-colors
                  ${isMe ? 'bg-violet-600/10 border-l-2 border-violet-500' : idx % 2 === 0 ? 'bg-white/[0.02]' : ''}
                  ${idx < visibleEntries.length - 1 ? 'border-b border-white/5' : ''}
                `}
              >
                {/* Rank */}
                <div className="w-8 flex justify-center">
                  {isTop3
                    ? <RankBadge rank={entry.rank} />
                    : <span className="text-white/40 text-sm font-bold">{entry.rank}</span>
                  }
                </div>

                {/* Username */}
                <div className="min-w-0">
                  <p className={`font-bold truncate ${isMe ? 'text-violet-300' : 'text-white'}`}>
                    {entry.username}
                    {isMe && <span className="ml-2 text-xs font-normal text-violet-400/70">(you)</span>}
                  </p>
                  <p className="text-white/30 text-xs">{entry.wins}W {entry.losses}L</p>
                </div>

                {/* Total bets */}
                <span className="text-white/60 text-sm text-right">{entry.total_bets}</span>

                {/* Win rate */}
                <div className="text-right">
                  <span className={`text-sm font-bold ${entry.win_rate >= 55 ? 'text-emerald-400' : entry.win_rate >= 45 ? 'text-white' : 'text-red-400'}`}>
                    {entry.win_rate}%
                  </span>
                </div>

                {/* ROI */}
                <div className="text-right">
                  <RoiChip roi={entry.roi} />
                </div>

                {/* P&L */}
                <div className="text-right">
                  <span className={`text-sm font-bold ${entry.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {entry.total_pnl >= 0 ? '+' : ''}£{Math.abs(entry.total_pnl).toFixed(0)}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Locked rows */}
          {lockedCount > 0 && (
            <div className="relative">
              {/* Blurred fake rows */}
              {[1,2,3].map(i => (
                <div key={i} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-4 border-t border-white/5 filter blur-sm select-none">
                  <span className="text-white/40 text-sm font-bold">{visibleEntries.length + i}</span>
                  <div>
                    <p className="text-white font-bold">tipster_{Math.random().toString(36).slice(2,8)}</p>
                    <p className="text-white/30 text-xs">??W ??L</p>
                  </div>
                  <span className="text-white/60 text-sm text-right">??</span>
                  <span className="text-white font-bold text-right">??%</span>
                  <span className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400">+??%</span>
                  <span className="text-emerald-400 text-sm font-bold text-right">+£??</span>
                </div>
              ))}

              {/* Upgrade overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#13162b]/80">
                <p className="text-white font-bold mb-1">🔒 {lockedCount} tipsters hidden</p>
                <p className="text-white/50 text-sm mb-3">Upgrade to Pro to see the full leaderboard</p>
                <a
                  href="/api/stripe/create-checkout?plan=pro"
                  className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors"
                >
                  Upgrade to Pro — £9.99/mo
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer note */}
      {!loading && leaderboard.length > 0 && (
        <p className="text-center text-white/20 text-xs mt-4">
          Rankings update in real-time · Sorted by ROI · Minimum 5 settled bets to qualify
        </p>
      )}
    </div>
  )
}
