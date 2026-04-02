import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { Resend } from 'resend'
import { buildWeeklyReportEmail } from '@/lib/email/weeklyReportTemplate'

// Supabase admin client (service role — bypasses RLS to read all users)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://footballbetai.vercel.app'

// Vercel Cron hits this with Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const weekLabel = formatWeekLabel(weekAgo)
  const weekStart = weekAgo.toISOString().split('T')[0]

  // Fetch all profiles
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, username, email, subscription_tier')

  if (profilesError || !profiles) {
    console.error('Failed to fetch profiles:', profilesError)
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
  }

  const results = { sent: 0, skipped: 0, errors: 0 }

  for (const profile of profiles) {
    try {
      // Fetch bets from the past 7 days
      const { data: bets } = await supabaseAdmin
        .from('bet_slips')
        .select('*')
        .eq('user_id', profile.user_id)
        .gte('created_at', weekAgo.toISOString())
        .order('created_at', { ascending: false })

      // Skip users with fewer than 2 bets this week (not enough data)
      if (!bets || bets.length < 2) {
        results.skipped++
        continue
      }

      // Generate AI report
      const report = await generateReport(bets)
      if (!report) {
        results.errors++
        continue
      }

      // Save report to DB
      await supabaseAdmin.from('weekly_reports').upsert({
        user_id: profile.user_id,
        week_start: weekStart,
        report_data: report,
      }, { onConflict: 'user_id,week_start' })

      // Build and send email (skip if Resend key not yet configured)
      const resendKey = process.env.RESEND_API_KEY || ''
      if (!resendKey || resendKey.startsWith('re_placeholder')) {
        console.log('RESEND_API_KEY not configured — report saved to DB but email not sent')
        results.skipped++
        continue
      }

      const { subject, html } = buildWeeklyReportEmail({
        username: profile.username,
        email: profile.email,
        report,
        weekLabel,
        subscriptionTier: profile.subscription_tier || 'free',
        appUrl: APP_URL,
      })

      const { error: emailError } = await resend.emails.send({
        from: 'BetIQ <reports@betiq.ai>',
        to: profile.email,
        subject,
        html,
      })

      if (emailError) {
        console.error(`Email failed for ${profile.email}:`, emailError)
        results.errors++
      } else {
        results.sent++
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200))

    } catch (err) {
      console.error(`Error processing user ${profile.user_id}:`, err)
      results.errors++
    }
  }

  console.log('Weekly email cron completed:', results)
  return NextResponse.json({ success: true, ...results })
}

async function generateReport(bets: Array<Record<string, unknown>>) {
  try {
    const won = bets.filter(b => b.result === 'win')
    const lost = bets.filter(b => b.result === 'loss')
    const settled = bets.filter(b => b.result === 'win' || b.result === 'loss')
    const totalPnL = bets.reduce((s, b) => s + (Number(b.profit_loss) || 0), 0)
    const winRate = settled.length > 0 ? Math.round((won.length / settled.length) * 100) : 0
    const bestBet = [...won].sort((a, b) => Number(b.profit_loss) - Number(a.profit_loss))[0]
    const worstBet = [...lost].sort((a, b) => Number(a.profit_loss) - Number(b.profit_loss))[0]
    const totalStake = bets.reduce((s, b) => s + Number(b.stake), 0)
    const roi = totalStake > 0 ? ((totalPnL / totalStake) * 100).toFixed(1) : '0.0'

    const betSummary = bets.slice(0, 20).map(b =>
      `${b.match_name || `${b.home_team} vs ${b.away_team}`} | ${b.bet_type} | Odds ${b.odds} | Stake £${b.stake} | Result: ${b.result} | P&L: £${b.profit_loss}`
    ).join('\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: 'You are BetIQ, an expert football betting coach. Generate honest, insightful weekly reports. Be specific and constructive. Return valid JSON only.'
      }, {
        role: 'user',
        content: `Weekly betting report for last 7 days:

Stats: ${bets.length} bets | ${won.length}W ${lost.length}L | Win Rate: ${winRate}% | P&L: £${totalPnL.toFixed(2)} | ROI: ${roi}%
Best bet: ${bestBet ? `${bestBet.match_name} +£${Number(bestBet.profit_loss).toFixed(2)}` : 'None'}
Worst bet: ${worstBet ? `${worstBet.match_name} -£${Math.abs(Number(worstBet.profit_loss)).toFixed(2)}` : 'None'}

Bets:
${betSummary}

Return JSON:
{
  "grade": "A+|A|B+|B|C+|C|D|F",
  "headline": "5-8 word punchy headline",
  "summary": "2-3 sentence honest assessment",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["area 1", "area 2"],
  "best_bet": "comment on best decision",
  "worst_bet": "constructive comment on toughest loss",
  "tip_for_next_week": "one specific actionable tip",
  "stats": {
    "bets": ${bets.length},
    "wins": ${won.length},
    "losses": ${lost.length},
    "win_rate": "${winRate}%",
    "pnl": ${totalPnL.toFixed(2)},
    "roi": "${roi}%"
  }
}`
      }],
      max_tokens: 800,
    })

    return JSON.parse(completion.choices[0]?.message?.content || '{}')
  } catch (err) {
    console.error('OpenAI report generation failed:', err)
    return null
  }
}

function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${fmt(weekStart)} – ${fmt(end)}`
}
