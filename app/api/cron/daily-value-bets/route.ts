import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get today's value bets (is_value_bet = true, created today)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { data: picks, error: picksError } = await supabaseAdmin
    .from('prediction_records')
    .select('home_team, away_team, league, bet_type, odds, ev_percent, ai_probability, kick_off')
    .eq('is_value_bet', true)
    .gt('ev_percent', 0)
    .lte('ev_percent', 10)   // MAX_REAL_EV — kill stale +20% rows
    .lte('odds', 4.0)
    .gte('created_at', today.toISOString())
    .order('ev_percent', { ascending: false })
    .limit(5)

  if (picksError || !picks || picks.length === 0) {
    return NextResponse.json({ sent: 0, reason: 'No value bets today' })
  }

  // Get users who have opted in to daily alerts
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, email')
    .eq('daily_alert_opt_in', true)
    .not('email', 'is', null)

  if (profilesError || !profiles || profiles.length === 0) {
    return NextResponse.json({ sent: 0, reason: 'No opted-in users' })
  }

  const results = { sent: 0, errors: 0 }

  const picksHtml = picks.map(p => {
    const kickOff = new Date(p.kick_off).toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })
    return `
      <tr style="border-bottom:1px solid #1e2035;">
        <td style="padding:12px 8px;color:#fff;font-size:13px;">
          <div style="font-weight:600;">${p.home_team} vs ${p.away_team}</div>
          <div style="color:#6b7280;font-size:11px;">${p.league} · ${kickOff}</div>
        </td>
        <td style="padding:12px 8px;text-align:center;">
          <span style="background:#1e1b4b;color:#a5b4fc;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600;">${p.bet_type}</span>
        </td>
        <td style="padding:12px 8px;text-align:center;color:#fff;font-weight:700;">@${Number(p.odds).toFixed(2)}</td>
        <td style="padding:12px 8px;text-align:center;color:#34d399;font-weight:700;">+${Number(p.ev_percent).toFixed(1)}%</td>
      </tr>
    `
  }).join('')

  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#0b0b14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" style="max-width:560px;margin:0 auto;padding:32px 16px;">
        <tr><td>
          <!-- Logo -->
          <table width="100%" style="margin-bottom:28px;">
            <tr>
              <td>
                <div style="display:inline-flex;align-items:center;gap:8px;">
                  <div style="width:36px;height:36px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:16px;text-align:center;line-height:36px;">B</div>
                  <span style="font-size:18px;font-weight:700;color:#fff;">Bet<span style="color:#a78bfa;">IQ</span></span>
                </div>
              </td>
            </tr>
          </table>

          <!-- Header -->
          <div style="background:linear-gradient(135deg,rgba(124,58,237,0.15),rgba(79,70,229,0.08));border:1px solid rgba(124,58,237,0.25);border-radius:16px;padding:24px;margin-bottom:24px;">
            <p style="color:#a78bfa;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">🔥 Daily Value Bets</p>
            <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">${picks.length} AI Value Bet${picks.length>1?'s':''} for ${dateLabel}</h1>
            <p style="color:rgba(255,255,255,0.45);font-size:13px;margin:0;">Only picks where EV% is positive — meaning the odds offer more value than our AI's estimated true probability.</p>
          </div>

          <!-- Picks table -->
          <table width="100%" style="background:#13131f;border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;border-collapse:collapse;margin-bottom:24px;">
            <thead>
              <tr style="background:rgba(255,255,255,0.03);">
                <th style="padding:10px 8px;text-align:left;color:rgba(255,255,255,0.35);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Match</th>
                <th style="padding:10px 8px;text-align:center;color:rgba(255,255,255,0.35);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Pick</th>
                <th style="padding:10px 8px;text-align:center;color:rgba(255,255,255,0.35);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Odds</th>
                <th style="padding:10px 8px;text-align:center;color:rgba(255,255,255,0.35);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">EV</th>
              </tr>
            </thead>
            <tbody>
              ${picksHtml}
            </tbody>
          </table>

          <!-- CTA -->
          <div style="text-align:center;margin-bottom:28px;">
            <a href="${APP_URL}/dashboard/suggestions" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-weight:700;font-size:14px;padding:14px 32px;border-radius:12px;text-decoration:none;">
              View Full Analysis →
            </a>
          </div>

          <!-- Disclaimer -->
          <p style="color:rgba(255,255,255,0.2);font-size:11px;text-align:center;line-height:1.6;">
            These are AI-generated suggestions, not financial advice. Bet responsibly.<br>
            <a href="${APP_URL}/dashboard/settings" style="color:rgba(255,255,255,0.3);">Unsubscribe from daily alerts</a>
          </p>
        </td></tr>
      </table>
    </body>
    </html>
  `

  for (const profile of profiles) {
    if (!profile.email) continue
    try {
      await resend.emails.send({
        from: 'MatchMind <alerts@matchmindcom.com>',
        to: profile.email,
        subject: `🔥 ${picks.length} AI Value Bet${picks.length>1?'s':''} for Today — ${dateLabel}`,
        html,
      })
      results.sent++
    } catch (err) {
      console.error(`Failed to send to ${profile.email}:`, err)
      results.errors++
    }
  }

  return NextResponse.json({ ...results, picks: picks.length, users: profiles.length })
}
