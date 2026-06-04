import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { rateLimit, getClientKey, rateLimitResponse } from '@/lib/rate-limit'

export const revalidate = 300 // 5 min cache

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Public endpoint — returns today's top value bets (no odds shown, blurred in UI)
export async function GET(request: Request) {
  const rl = rateLimit(`public-predictions:${getClientKey(request)}`, 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl.resetMs)

  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: bets, error } = await supabaseAdmin
      .from('prediction_records')
      .select('id, home_team, away_team, league, bet_type, odds, ev_percent, ai_probability, kick_off, is_value_bet')
      .is('result', null)
      .eq('is_value_bet', true)
      .gt('ev_percent', 0)
      .lte('ev_percent', 10)   // MAX_REAL_EV — kill stale +20% rows
      .lte('odds', 4.0)
      .gte('kick_off', todayStart.toISOString())
      .order('ev_percent', { ascending: false })
      .limit(3)

    if (error) throw error

    return NextResponse.json({
      success: true,
      predictions: bets || [],
      hasData: (bets?.length ?? 0) > 0,
    })
  } catch (err) {
    console.error('Public predictions error:', err)
    return NextResponse.json({ success: false, predictions: [], hasData: false })
  }
}
