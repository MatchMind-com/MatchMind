import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import {
  buildDay1Email,
  buildDay3Email,
  buildDay6Email,
} from '@/lib/email/onboardingTemplates'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM = 'MatchMind <hello@matchmindcom.company>'

/**
 * Vercel Cron — runs daily at 09:00 UTC.
 * Checks every user's created_at and sends the right onboarding email
 * on day 1, day 3, and day 6 of their trial.
 *
 * To avoid double-sends we track sent emails in the `onboarding_emails` table.
 * Schema (run once in Supabase SQL editor):
 *
 *   create table if not exists onboarding_emails (
 *     user_id uuid references auth.users(id) on delete cascade,
 *     day     int,
 *     sent_at timestamptz default now(),
 *     primary key (user_id, day)
 *   );
 */
export async function GET(req: NextRequest) {
  // Auth check — Vercel passes CRON_SECRET as Bearer token
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendKey = process.env.RESEND_API_KEY || ''
  if (!resendKey || resendKey.startsWith('re_placeholder')) {
    return NextResponse.json({ skipped: 'RESEND_API_KEY not configured' })
  }

  const now = new Date()
  const results = { sent: 0, skipped: 0, errors: 0 }

  // Fetch all profiles created within the last 7 days
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('user_id, email, full_name, created_at, subscription_tier')
    .gte('created_at', sevenDaysAgo.toISOString())

  if (error || !profiles) {
    console.error('Failed to fetch profiles:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  for (const profile of profiles) {
    if (!profile.email) continue

    const created = new Date(profile.created_at)
    const daysSince = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))

    // Determine which day email to send (1, 3, or 6)
    const targetDay = [1, 3, 6].includes(daysSince) ? daysSince : null
    if (targetDay === null) continue

    // Skip if already paid — don't send trial emails to paying users
    if (profile.subscription_tier === 'pro' || profile.subscription_tier === 'elite') {
      results.skipped++
      continue
    }

    // Check if this day's email has already been sent
    const { data: existing } = await supabaseAdmin
      .from('onboarding_emails')
      .select('user_id')
      .eq('user_id', profile.user_id)
      .eq('day', targetDay)
      .maybeSingle()

    if (existing) {
      results.skipped++
      continue
    }

    // Build the right email
    const name = profile.full_name?.split(' ')[0] || undefined
    let email: { subject: string; html: string }

    if (targetDay === 1) email = buildDay1Email({ email: profile.email, name })
    else if (targetDay === 3) email = buildDay3Email({ email: profile.email, name })
    else email = buildDay6Email({ email: profile.email, name })

    // Send
    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: profile.email,
      subject: email.subject,
      html: email.html,
    })

    if (sendError) {
      console.error(`Onboarding day ${targetDay} failed for ${profile.email}:`, sendError)
      results.errors++
      continue
    }

    // Record the send so we never send it again
    await supabaseAdmin.from('onboarding_emails').insert({
      user_id: profile.user_id,
      day: targetDay,
    })

    results.sent++

    // Rate limit buffer
    await new Promise(r => setTimeout(r, 150))
  }

  console.log('Onboarding email cron done:', results)
  return NextResponse.json({ success: true, ...results })
}
