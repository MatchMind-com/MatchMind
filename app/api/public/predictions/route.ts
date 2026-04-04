import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const revalidate = 300 // 5 min cache

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Public endpoint — returns today's top value bets (no odds shown, blurred in UI)
export async function GET() {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: bets, error } = await supabaseAdmin
      .from('prediction_records')
      .select('id, home_team, away_team, league, bet_type, odds, ev_percent, ai_probability, kick_off, is_value_bet')
      .is('result', null)
      .eq('is_value_bet', true)
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
