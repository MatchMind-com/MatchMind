import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: check if user has completed onboarding
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ completed: false })

  const { data } = await supabase
    .from('user_preferences')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ completed: data?.onboarding_completed ?? false })
}

// POST: save onboarding preferences
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    favourite_team,
    lucky_charm_team,
    favourite_leagues,
    betting_experience,
    monthly_pl_estimate,
    preferred_bet_types,
  } = body

  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: user.id,
      favourite_team,
      lucky_charm_team,
      favourite_leagues: favourite_leagues || [],
      betting_experience,
      monthly_pl_estimate,
      preferred_bet_types: preferred_bet_types || [],
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) {
    console.error('Onboarding save error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
