import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/tipsters — list all active tipsters
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('tipsters')
    .select('*')
    .eq('is_active', true)
    .order('roi', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tipsters: data || [] })
}

// POST /api/tipsters — register as a tipster
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { display_name, bio, speciality, monthly_price } = await req.json()

  if (!display_name?.trim()) return NextResponse.json({ error: 'Display name required' }, { status: 400 })
  if (!monthly_price || monthly_price < 4.99 || monthly_price > 49.99) {
    return NextResponse.json({ error: 'Price must be between £4.99 and £49.99' }, { status: 400 })
  }

  // Check if already a tipster
  const { data: existing } = await supabaseAdmin
    .from('tipsters').select('id').eq('user_id', user.id).single()
  if (existing) return NextResponse.json({ error: 'Already registered as a tipster' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('tipsters')
    .insert({ user_id: user.id, display_name, bio, speciality, monthly_price })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tipster: data })
}
