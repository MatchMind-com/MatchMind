import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const revalidate = 300 // cache for 5 minutes

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const [
      { count: userCount },
      { count: tipsterCount },
      { count: betCount },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('tipsters').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('bets').select('*', { count: 'exact', head: true }),
    ])

    return NextResponse.json({
      users: userCount ?? 0,
      tipsters: tipsterCount ?? 0,
      bets_tracked: betCount ?? 0,
      // These will be replaced with real data once track record system is live
      ai_accuracy: 61,
      value_bets_today: 9,
      leagues_covered: 15,
    })
  } catch {
    return NextResponse.json({
      users: 0,
      tipsters: 0,
      bets_tracked: 0,
      ai_accuracy: 61,
      value_bets_today: 9,
      leagues_covered: 15,
    })
  }
}
