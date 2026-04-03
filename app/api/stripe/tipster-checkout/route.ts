import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/stripe/tipster-checkout — subscribe to a tipster
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tipster_id } = await req.json()
  if (!tipster_id) return NextResponse.json({ error: 'tipster_id required' }, { status: 400 })

  const { data: tipster } = await supabaseAdmin
    .from('tipsters').select('*').eq('id', tipster_id).single()
  if (!tipster) return NextResponse.json({ error: 'Tipster not found' }, { status: 404 })

  // Can't subscribe to yourself
  if (tipster.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot subscribe to yourself' }, { status: 400 })
  }

  // Check not already subscribed
  const { data: existing } = await supabaseAdmin
    .from('tipster_subscriptions')
    .select('id, status')
    .eq('tipster_id', tipster_id)
    .eq('subscriber_id', user.id)
    .single()

  if (existing?.status === 'active') {
    return NextResponse.json({ error: 'Already subscribed' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://footballbetai.vercel.app'

  // Create Stripe Checkout session for tipster subscription
  // We create a one-time price on the fly (or use a product per tipster)
  const price = await stripe.prices.create({
    currency: 'gbp',
    unit_amount: Math.round(tipster.monthly_price * 100),
    recurring: { interval: 'month' },
    product_data: {
      name: `${tipster.display_name} — BetIQ Tipster`,
      metadata: { tipster_id },
    },
  })

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: price.id, quantity: 1 }],
    success_url: `${appUrl}/dashboard/tipsters/${tipster_id}?subscribed=true`,
    cancel_url: `${appUrl}/dashboard/tipsters/${tipster_id}`,
    client_reference_id: user.id,
    metadata: { tipster_id, subscriber_id: user.id },
    subscription_data: {
      metadata: { tipster_id, subscriber_id: user.id },
    },
  })

  return NextResponse.json({ url: session.url })
}
