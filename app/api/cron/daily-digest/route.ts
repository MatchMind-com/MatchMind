import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { buildDailyDigestEmail } from '@/lib/email/dailyDigestTemplate'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
      req.headers.get('x-vercel-cron') !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendKey = process.env.RESEND_API_KEY || ''
  if (!resendKey || resendKey.startsWith('re_placeholder')) {
    return NextResponse.json({ message: 'RESEND_API_KEY not configured — skipping email send', sent: 0 })
  }

  // Today's value bets from prediction_records (stored when predictions page loads)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: valueBets, error: betsError } = await supabaseAdmin
    .from('prediction_records')
    .select('home_team, away_team, league, bet_type, odds, ev_percent, kick_off, is_value_bet')
    .is('result', null)
    .eq('is_value_bet', true)
    .gte('kick_off', todayStart.toISOString())
    .order('ev_percent', { ascending: false })
    .limit(3)

  if (betsError) {
    console.error('Failed to fetch value bets:', betsError)
    return NextResponse.json({ error: betsError.message }, { status: 500 })
  }

  if (!valueBets || valueBets.length === 0) {
    return NextResponse.json({ message: 'No value bets found for today — digest skipped', sent: 0 })
  }

  // Fetch all profiles to send to
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, username, email, subscription_tier')

  if (profilesError || !profiles) {
    console.error('Failed to fetch profiles:', profilesError)
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
  }

  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short'
  })

  const results = { sent: 0, skipped: 0, errors: 0 }

  for (const profile of profiles) {
    try {
      if (!profile.email) { results.skipped++; continue }

      const tier = (profile.subscription_tier as 'free' | 'pro' | 'elite') || 'free'

      const { subject, html } = buildDailyDigestEmail({
        username: profile.username || profile.email.split('@')[0],
        bets: valueBets,
        date: dateLabel,
        subscriptionTier: tier,
        appUrl: APP_URL,
      })

      const { error: emailError } = await resend.emails.send({
        from: 'MatchMind <picks@matchmindcom.company>',
        to: profile.email,
        subject,
        html,
      })

      if (emailError) {
        console.error(`Daily digest email failed for ${profile.email}:`, emailError)
        results.errors++
      } else {
        results.sent++
      }

      // Small delay to avoid Resend rate limits
      await new Promise(r => setTimeout(r, 100))

    } catch (err) {
      console.error(`Error processing ${profile.email}:`, err)
      results.errors++
    }
  }

  console.log('Daily digest cron completed:', results)
  return NextResponse.json({
    success: true,
    message: `Sent ${results.sent} daily digest emails`,
    value_bets_found: valueBets.length,
    ...results,
  })
}
