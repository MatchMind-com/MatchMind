import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

export async function POST(req: NextRequest) {
  try {
    const { email, source } = await req.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const normalised = email.trim().toLowerCase()
    // Source tag for attribution — admin dashboard segments signups by
    // source ('world-cup', 'home-page', etc). Falls back to 'home-page'
    // when callers don't pass one (keeps existing behaviour intact).
    const sourceTag =
      typeof source === 'string' && source.trim().length > 0
        ? source.trim().slice(0, 40)
        : 'home-page'

    // Upsert — reactivate if previously unsubscribed, also stamp the
    // source on every insert/update (last-write-wins is fine; the user
    // typically subscribes once).
    const { error } = await supabaseAdmin
      .from('email_subscribers')
      .upsert(
        {
          email: normalised,
          is_active: true,
          unsubscribed_at: null,
          subscribed_at: new Date().toISOString(),
          source: sourceTag,
        },
        { onConflict: 'email' }
      )

    if (error) {
      console.error('Subscribe upsert error:', error)
      return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
    }

    // Fetch today's top value bet to include in welcome email
    const { data: topBets } = await supabaseAdmin
      .from('prediction_records')
      .select('home_team, away_team, league, bet_type, odds, ev_percent, ai_probability, kick_off')
      .is('result', null)
      .eq('is_value_bet', true)
      .lte('ev_percent', 25)
      .lte('odds', 4.0)
      .order('ev_percent', { ascending: false })
      .limit(3)

    const hasRealBets = topBets && topBets.length > 0

    const betHtml = hasRealBets
      ? topBets.map((b: any, i: number) => `
        <div style="background:#12121F;border:1px solid rgba(134,239,172,0.2);border-radius:12px;padding:14px 16px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
            <div>
              <p style="color:#fff;font-weight:700;font-size:14px;margin:0 0 2px 0;">${b.home_team} vs ${b.away_team}</p>
              <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0;">${b.league}</p>
            </div>
            <span style="color:#4ade80;font-weight:900;font-size:13px;">+${b.ev_percent}% EV</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="background:rgba(139,92,246,0.2);color:#c4b5fd;font-size:12px;font-weight:600;padding:4px 10px;border-radius:8px;border:1px solid rgba(139,92,246,0.2);">${b.bet_type}</span>
            <span style="color:#fff;font-weight:700;font-size:13px;">@ ${b.odds}</span>
            <span style="color:rgba(255,255,255,0.35);font-size:12px;margin-left:auto;">AI: ${b.ai_probability}%</span>
          </div>
        </div>`).join('')
      : `
        <div style="background:#12121F;border:1px solid rgba(134,239,172,0.2);border-radius:12px;padding:14px 16px;">
          <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0;">Live value bets will land in your inbox every morning once the AI has analysed today&apos;s fixtures. Expect your first picks tomorrow.</p>
        </div>`

    await resend.emails.send({
      from: 'MatchMind <reports@matchmindcom.com>',
      to: normalised,
      subject: hasRealBets ? `⚡ Today's top ${topBets!.length} value bet${topBets!.length > 1 ? 's' : ''} — MatchMind` : '⚡ You\'re on the MatchMind list — MatchMind',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#0B0B14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <div style="max-width:540px;margin:0 auto;padding:32px 16px;">
            <!-- Logo -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px;">
              <div style="width:36px;height:36px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:18px;">B</div>
              <span style="color:#fff;font-weight:700;font-size:20px;">Bet<span style="color:#a78bfa;">IQ</span></span>
            </div>

            <!-- Heading -->
            <h1 style="color:#fff;font-size:28px;font-weight:900;margin:0 0 8px 0;">
              ${hasRealBets ? "Today's value bets ⚡" : "You're in the list 🎉"}
            </h1>
            <p style="color:rgba(255,255,255,0.45);font-size:15px;margin:0 0 24px 0;">
              ${hasRealBets
                ? 'The AI has identified these positive-EV bets for today. Each one has a mathematical edge over the bookmaker.'
                : 'Every morning we\'ll send you the day\'s top value bets — bets where the AI has found a real mathematical edge over the bookmaker.'}
            </p>

            <!-- Bets -->
            ${betHtml}

            <!-- CTA -->
            <div style="margin-top:28px;text-align:center;">
              <a href="${APP_URL}/signup" style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:14px;text-decoration:none;box-shadow:0 8px 32px rgba(124,58,237,0.35);">
                Create Free Account — See All Picks →
              </a>
              <p style="color:rgba(255,255,255,0.2);font-size:12px;margin-top:12px;">No credit card required · Free forever plan</p>
            </div>

            <!-- Footer -->
            <div style="border-top:1px solid rgba(255,255,255,0.06);margin-top:32px;padding-top:20px;text-align:center;">
              <p style="color:rgba(255,255,255,0.2);font-size:11px;margin:0;">
                For analytics purposes only. Please gamble responsibly. 18+.<br>
                <a href="${APP_URL}/unsubscribe?email=${encodeURIComponent(normalised)}" style="color:rgba(255,255,255,0.2);">Unsubscribe</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Subscribe error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
