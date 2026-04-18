import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia' as any,
})

const PLANS = {
  pro: process.env.STRIPE_PRO_PRICE_ID!,
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const plan = searchParams.get('plan') as 'pro'
    const coupon = searchParams.get('coupon') // e.g. MATCHMIND20

    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/auth/signin', request.url))
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PLANS[plan],
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          user_id: user.id,
          plan,
        },
      },
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        plan,
      },
      success_url: `${appUrl}/dashboard?upgrade=success&plan=${plan}`,
      cancel_url: `${appUrl}/dashboard?upgrade=cancelled`,
    }

    // Apply coupon if provided (e.g. MATCHMIND20)
    if (coupon) {
      // Look up or create the coupon in Stripe
      try {
        await stripe.coupons.retrieve(coupon)
      } catch {
        // Coupon doesn't exist — create it
        await stripe.coupons.create({
          id: coupon,
          percent_off: 20,
          duration: 'once', // applies to first invoice only
          name: '20% off first month',
          max_redemptions: 1000,
        })
      }
      sessionParams.discounts = [{ coupon }]
      // Note: trial + coupon = 7 days free, then 20% off first paid month
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.redirect(session.url!)
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
