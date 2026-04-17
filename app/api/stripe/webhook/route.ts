import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createAdmin } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  // ── Platform subscription (MatchMind Pro) ──────────────────────────────────────
  async function updatePlatformSubscription(subscription: Stripe.Subscription) {
    // create-checkout sends: metadata.user_id and metadata.plan
    const userId = subscription.metadata?.user_id
    const tier = subscription.metadata?.plan || 'free'
    if (!userId) return

    const isActive = ['active', 'trialing'].includes(subscription.status)
    // Use supabaseAdmin (service role) — webhooks have no user session, so RLS would block
    await supabaseAdmin.from('profiles').update({
      subscription_tier: isActive ? tier : 'free',
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      subscription_status: subscription.status,
      subscription_current_period_end: new Date(((subscription as any).current_period_end ?? 0) * 1000).toISOString(),
    }).eq('user_id', userId)
  }

  // ── Tipster subscription ────────────────────────────────────────────────────
  async function handleTipsterSubscription(subscription: Stripe.Subscription, status: 'active' | 'canceled') {
    const { tipster_id, subscriber_id } = subscription.metadata || {}
    if (!tipster_id || !subscriber_id) return

    const { data: existing } = await supabaseAdmin
      .from('tipster_subscriptions')
      .select('id')
      .eq('tipster_id', tipster_id)
      .eq('subscriber_id', subscriber_id)
      .single()

    if (existing) {
      await supabaseAdmin
        .from('tipster_subscriptions')
        .update({ status, stripe_subscription_id: subscription.id })
        .eq('id', existing.id)
    } else if (status === 'active') {
      await supabaseAdmin.from('tipster_subscriptions').insert({
        tipster_id,
        subscriber_id,
        stripe_subscription_id: subscription.id,
        status: 'active',
      })
    }
  }

  // Determine if this subscription is a tipster sub (has tipster_id metadata)
  function isTipsterSub(sub: Stripe.Subscription) {
    return !!sub.metadata?.tipster_id
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      if (isTipsterSub(sub)) {
        const isActive = ['active', 'trialing'].includes(sub.status)
        await handleTipsterSubscription(sub, isActive ? 'active' : 'canceled')
      } else {
        await updatePlatformSubscription(sub)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      if (isTipsterSub(sub)) {
        await handleTipsterSubscription(sub, 'canceled')
      } else {
        const userId = sub.metadata?.user_id
        if (userId) {
          await supabaseAdmin.from('profiles').update({
            subscription_tier: 'free',
            subscription_status: 'canceled',
            stripe_subscription_id: null,
          }).eq('user_id', userId)
        }
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      if ((invoice as any).subscription) {
        const sub = await stripe.subscriptions.retrieve((invoice as any).subscription as string)
        if (!isTipsterSub(sub)) {
          await updatePlatformSubscription(sub)
        }
      }
      break
    }

    // Handle checkout.session.completed as backup for tipster subscriptions
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const { tipster_id, subscriber_id } = session.metadata || {}
      if (tipster_id && subscriber_id && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        if (['active', 'trialing'].includes(sub.status)) {
          await handleTipsterSubscription(sub, 'active')
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}

