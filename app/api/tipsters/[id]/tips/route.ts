import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/tipsters/[id]/tips — tipster posts a new tip
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify this user owns the tipster profile
  const { data: tipster } = await supabaseAdmin
    .from('tipsters').select('id').eq('id', params.id).eq('user_id', user.id).single()
  if (!tipster) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { match_name, league, kick_off, bet_type, odds, stake_units, reasoning, is_free } = await req.json()

  if (!match_name || !bet_type || !odds) {
    return NextResponse.json({ error: 'match_name, bet_type and odds are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('tips')
    .insert({
      tipster_id: params.id,
      match_name,
      league,
      kick_off,
      bet_type,
      odds: parseFloat(odds),
      stake_units: parseFloat(stake_units) || 1,
      reasoning,
      is_free: !!is_free,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tip: data })
}
