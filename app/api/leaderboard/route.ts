import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, username')

    if (profilesError || !profiles) {
      return NextResponse.json({ success: false, error: 'Failed to fetch profiles' }, { status: 500 })
    }

    // Fetch all settled bets (win/loss only) aggregated by user
    const { data: bets, error: betsError } = await supabaseAdmin
      .from('bet_slips')
      .select('user_id, result, stake, profit_loss')
      .in('result', ['win', 'loss'])

    if (betsError) {
      return NextResponse.json({ success: false, error: 'Failed to fetch bets' }, { status: 500 })
    }

    // Aggregate per user
    const userStats: Record<string, {
      wins: number
      losses: number
      total_stake: number
      total_pnl: number
    }> = {}

    for (const bet of bets || []) {
      if (!userStats[bet.user_id]) {
        userStats[bet.user_id] = { wins: 0, losses: 0, total_stake: 0, total_pnl: 0 }
      }
      const s = userStats[bet.user_id]
      if (bet.result === 'win') s.wins++
      else s.losses++
      s.total_stake += Number(bet.stake) || 0
      s.total_pnl += Number(bet.profit_loss) || 0
    }

    // Build leaderboard — minimum 5 settled bets to qualify
    const MIN_BETS = 5
    const leaderboard = profiles
      .map(profile => {
        const stats = userStats[profile.user_id]
        if (!stats) return null
        const totalBets = stats.wins + stats.losses
        if (totalBets < MIN_BETS) return null
        const winRate = totalBets > 0 ? Math.round((stats.wins / totalBets) * 100) : 0
        const roi = stats.total_stake > 0
          ? parseFloat(((stats.total_pnl / stats.total_stake) * 100).toFixed(1))
          : 0
        return {
          user_id: profile.user_id,
          username: profile.username,
          total_bets: totalBets,
          wins: stats.wins,
          losses: stats.losses,
          win_rate: winRate,
          roi,
          total_pnl: parseFloat(stats.total_pnl.toFixed(2)),
        }
      })
      .filter(Boolean)
      .sort((a, b) => b!.roi - a!.roi) // rank by ROI
      .slice(0, 50)
      .map((entry, i) => ({ ...entry, rank: i + 1 }))

    return NextResponse.json({ success: true, leaderboard })
  } catch (err) {
    console.error('Leaderboard error:', err)
    return NextResponse.json({ success: false, error: 'Failed to load leaderboard' }, { status: 500 })
  }
}
