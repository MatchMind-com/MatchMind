import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/tipsters/me — get the current user's tipster profile + their tips
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tipster } = await supabaseAdmin
    .from('tipsters')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!tipster) return NextResponse.json({ error: 'Not a tipster' }, { status: 404 })

  const { data: tips } = await supabaseAdmin
    .from('tips')
    .select('*')
    .eq('tipster_id', tipster.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ tipster, tips: tips || [] })
}
