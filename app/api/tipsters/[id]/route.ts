import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/tipsters/[id] — get tipster profile + tips + subscription status
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: tipster, error } = await supabaseAdmin
    .from('tipsters').select('*').eq('id', params.id).single()
  if (error || !tipster) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check if current user is subscribed
  let isSubscribed = false
  let isTipster = false
  if (user) {
    isTipster = tipster.user_id === user.id
    if (!isTipster) {
      const { data: sub } = await supabaseAdmin
        .from('tipster_subscriptions')
        .select('id')
        .eq('tipster_id', params.id)
        .eq('subscriber_id', user.id)
        .eq('status', 'active')
        .single()
      isSubscribed = !!sub
    }
  }

  // Fetch tips (free always visible; premium only if subscribed or own tipster)
  let tipsQuery = supabaseAdmin
    .from('tips')
    .select('*')
    .eq('tipster_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!isSubscribed && !isTipster) {
    tipsQuery = tipsQuery.eq('is_free', true)
  }

  const { data: tips } = await tipsQuery

  return NextResponse.json({ tipster, tips: tips || [], isSubscribed, isTipster })
}
