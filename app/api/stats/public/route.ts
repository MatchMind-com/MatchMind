import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const revalidate = 300 // cache for 5 minutes

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Allow the static command-center HTML at file:// to fetch this endpoint
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET() {
  try {
    const [
      { count: userCount },
      { count: tipsterCount },
      { count: betCount },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('tipsters').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('bet_slips').select('*', { count: 'exact', head: true }),
    ])

    return NextResponse.json({
      users: userCount ?? 0,
      tipsters: tipsterCount ?? 0,
      bets_tracked: betCount ?? 0,
      // These will be replaced with real data once track record system is live
      ai_accuracy: 61,
      value_bets_today: 9,
      leagues_covered: 15,
    }, { headers: CORS_HEADERS })
  } catch {
    return NextResponse.json({
      users: 0,
      tipsters: 0,
      bets_tracked: 0,
      ai_accuracy: 61,
      value_bets_today: 9,
      leagues_covered: 15,
    }, { headers: CORS_HEADERS })
  }
}
