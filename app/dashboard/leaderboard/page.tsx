'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { effectiveTier } from '@/lib/trial'

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
  is_demo?: boolean
}

const DEMO_ENTRIES: LeaderboardEntry[] = [
  { rank: 1, user_id: 'demo1', username: 'ValueKing_88',   total_bets: 142, wins: 87,  losses: 55, win_rate: 61, roi: 24.3, total_pnl: 1840, is_demo: true },
  { rank: 2, user_id: 'demo2', username: 'AccaHunter',     total_bets: 98,  wins: 58,  losses: 40, win_rate: 59, roi: 18.7, total_pnl: 1120, is_demo: true },
  { rank: 3, user_id: 'demo3', username: 'EVEdge_Pro',     total_bets: 210, wins: 118, losses: 92, win_rate: 56, roi: 14.2, total_pnl: 2210, is_demo: true },
  { rank: 4, user_id: 'demo4', username: 'SerieA_Sniper',  total_bets: 76,  wins: 43,  losses: 33, win_rate: 57, roi: 11.4, total_pnl: 630,  is_demo: true },
  { rank: 5, user_id: 'demo5', username: 'PremGoals_UK',   total_bets: 188, wins: 101, losses: 87, win_rate: 54, roi: 8.9,  total_pnl: 1470, is_demo: true },
  { rank: 6, user_id: 'demo6', username: 'AsianHandicapX', total_bets: 55,  wins: 29,  losses: 26, win_rate: 53, roi: 5.2,  total_pnl: 390,  is_demo: true },
  { rank: 7, user_id: 'demo7', username: 'BundesligaBets', total_bets: 120, wins: 63,  losses: 57, win_rate: 53, roi: 3.8,  total_pnl: 580,  is_demo: true },
]

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'elite'>('free')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id)
        supabase.from('profiles').select('subscription_tier, created_at').eq('user_id', user.id).single()
          .then(({ data }) => {
            if (data) {
              const tier = effectiveTier(data.subscription_tier, data.created_at)
              setSubscriptionTier(tier)
            }
          })
      }
    })
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => {
        const real = d.success ? (d.leaderboard || []) : []
        setLeaderboard(real.length > 0 ? real : DEMO_ENTRIES)
      })
      .catch(() => setLeaderboard(DEMO_ENTRIES))
      .finally(() => setLoading(false))
  }, [])

  const isShowingDemo = leaderboard.length > 0 && leaderboard[0]?.is_demo
  const myRank = leaderboard.find(e => e.user_id === currentUserId)
  const visibleEntries = subscriptionTier === 'free' ? leaderboard.slice(0, 5) : leaderboard
  const lockedCount = leaderboard.length - visibleEntries.length

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl">🏆</div>
          <div>
            <h1 className="text-2xl font-bold text-white">Community Leaderboard</h1>
            <p className="text-white/40 text-sm">Top bettors ranked by ROI · Min. 5 settled bets</p>
          </div>
        </div>
      </div>

      {!loading && isShowingDemo && (
        <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <span className="text-lg mt-0.5">✨</span>
          <div>
            <p className="text-violet-300 font-semibold text-sm">Sample leaderboard — be the first real entry!</p>
            <p className="text-white/40 text-xs mt-0.5">
              Add 5+ settled bets and you'll appear here automatically. These are example entries to show how it works.
            </p>
            <Link href="/dashboard" className="inline-block mt-2 text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">
              Add your first bet →
            </Link>
          </div>
        </div>
      )}

      {!loading && myRank && !myRank.is_demo && (
        <div className="bg-violet-600/10 border border-violet-500/30 rounded-2xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RankBadge rank={myRank.rank} />
            <div>
              <p className="text-white/50 text-xs">Your ranking</p>
              <p className="text-white font-bold">#{myRank.rank} of {leaderboard.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div><p className="text-white/40 text-xs">Win Rate</p><p className="text-white font-bold">{myRank.win_rate}%</p></div>
            <div><p className="text-white/40 text-xs">ROI</p><RoiChip roi={myRank.roi} /></div>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="bg-white/5 rounded-2xl h-16 animate-pulse border border-white/5" />)}
        </div>
      )}

      {!loading && leaderboard.length > 0 && (
        <div className="bg-[#13162b] border border-white/8 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-white/5">
            <span className="text-white/30 text-xs font-semibold w-8">#</span>
            <span className="text-white/30 text-xs font-semibold">Bettor</span>
            <span className="text-white/30 text-xs font-semibold text-right">Bets</span>
            <span className="text-white/30 text-xs font-semibold text-right">Win %</span>
            <span className="text-white/30 text-xs font-semibold text-right">ROI</span>
            <span className="text-white/30 text-xs font-semibold text-right">P&L</span>
          </div>

          {visibleEntries.map((entry, idx) => {
            const isMe = entry.user_id === currentUserId
            const isTop3 = entry.rank <= 3
            return (
              <div key={entry.user_id} className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-4 transition-colors ${isMe ? 'bg-violet-600/10 border-l-2 border-violet-500' : idx % 2 === 0 ? 'bg-white/[0.02]' : ''} ${entry.is_demo ? 'opacity-80' : ''} ${idx < visibleEntries.length - 1 ? 'border-b border-white/5' : ''}`}>
                <div className="w-8 flex justify-center">
                  {isTop3 ? <RankBadge rank={entry.rank} /> : <span className="text-white/40 text-sm font-bold">{entry.rank}</span>}
                </div>
                <div className="min-w-0">
                  <p className={`font-bold truncate ${isMe ? 'text-violet-300' : 'text-white'}`}>
                    {entry.username}
                    {isMe && <span className="ml-2 text-xs font-normal text-violet-400/70">(you)</span>}
                    {entry.is_demo && <span className="ml-1.5 text-[10px] text-white/25 font-normal border border-white/10 rounded px-1">demo</span>}
                  </p>
                  <p className="text-white/30 text-xs">{entry.wins}W {entry.losses}L</p>
                </div>
                <span className="text-white/60 text-sm text-right">{entry.total_bets}</span>
                <div className="text-right">
                  <span className={`text-sm font-bold ${entry.win_rate >= 55 ? 'text-emerald-400' : entry.win_rate >= 45 ? 'text-white' : 'text-red-400'}`}>{entry.win_rate}%</span>
                </div>
                <div className="text-right"><RoiChip roi={entry.roi} /></div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${entry.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {entry.total_pnl >= 0 ? '+' : ''}£{Math.abs(entry.total_pnl).toFixed(0)}
                  </span>
                </div>
              </div>
            )
          })}

          {lockedCount > 0 && (
            <div className="relative">
              {[1,2,3].map(i => (
                <div key={i} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-4 border-t border-white/5 filter blur-sm select-none">
                  <span className="text-white/40 text-sm font-bold">{visibleEntries.length + i}</span>
                  <div><p className="text-white font-bold">hidden_user</p><p className="text-white/30 text-xs">??W ??L</p></div>
                  <span className="text-white/60 text-sm text-right">??</span>
                  <span className="text-white font-bold text-right">??%</span>
                  <span className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400">+??%</span>
                  <span className="text-emerald-400 text-sm font-bold text-right">+£??</span>
                </div>
              ))}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#13162b]/80">
                <p className="text-white font-bold mb-1">🔒 {lockedCount} bettors hidden</p>
                <p className="text-white/50 text-sm mb-3">Upgrade to Pro to see the full leaderboard</p>
                <a href="/api/stripe/create-checkout?plan=pro" className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors">
                  Upgrade to Pro — £9.99/mo
                </a>
              </div>
            </div>
          )}
        </div>
      )}
      <p className="text-center text-white/20 text-xs mt-4">Rankings update in real-time · Sorted by ROI · Minimum 5 settled bets to qualify</p>
    </div>
  )
}
