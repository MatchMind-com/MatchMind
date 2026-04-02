interface ReportData {
  grade: string
  headline: string
  summary: string
  strengths: string[]
  improvements: string[]
  best_bet: string
  worst_bet: string
  tip_for_next_week: string
  stats: {
    bets: number
    wins: number
    losses: number
    win_rate: string
    pnl: number
    roi: string
  }
}

function gradeColor(grade: string): string {
  if (grade.startsWith('A')) return '#00C896'
  if (grade.startsWith('B')) return '#3B5BDB'
  if (grade.startsWith('C')) return '#FF8C00'
  return '#FF4757'
}

function pnlColor(pnl: number): string {
  return pnl >= 0 ? '#00C896' : '#FF4757'
}

export function buildWeeklyReportEmail(opts: {
  username: string
  email: string
  report: ReportData
  weekLabel: string
  subscriptionTier: 'free' | 'pro' | 'elite'
  appUrl: string
}): { subject: string; html: string } {
  const { username, report, weekLabel, subscriptionTier, appUrl } = opts
  const { stats, grade } = report
  const isFree = subscriptionTier === 'free'
  const gc = gradeColor(grade)
  const pnlStr = stats.pnl >= 0 ? `+£${stats.pnl.toFixed(2)}` : `-£${Math.abs(stats.pnl).toFixed(2)}`

  const subject = `⚽ Your BetIQ Weekly Report — ${grade} | ${weekLabel}`

  const upgradeSection = isFree ? `
    <tr>
      <td style="padding: 0 24px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e2a6e 0%, #3B5BDB 100%); border-radius: 12px; padding: 24px;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: rgba(255,255,255,0.7); text-transform: uppercase;">🔒 Pro Feature</p>
              <h3 style="margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #ffffff;">Unlock Full AI Analysis</h3>
              <p style="margin: 0 0 20px; font-size: 14px; color: rgba(255,255,255,0.85); line-height: 1.5;">
                Get deeper pattern analysis, league breakdown, unlimited bet tracking, and priority AI coaching — all for £9.99/month.
              </p>
              <a href="${appUrl}/api/stripe/create-checkout?plan=pro" style="display: inline-block; background: #ffffff; color: #3B5BDB; font-weight: 800; font-size: 15px; padding: 14px 32px; border-radius: 8px; text-decoration: none;">
                Start 7-Day Free Trial →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BetIQ Weekly Report</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0d1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0d1a; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #0F1117; border-radius: 16px; overflow: hidden; border: 1px solid #1e2540;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0d1440 0%, #1a2060 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid #1e2540;">
              <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.5); letter-spacing: 3px; text-transform: uppercase;">BetIQ</p>
              <h1 style="margin: 0 0 4px; font-size: 26px; font-weight: 800; color: #ffffff;">Weekly Performance Report</h1>
              <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.55);">${weekLabel}</p>
            </td>
          </tr>

          <!-- Grade + Headline -->
          <tr>
            <td style="padding: 32px 24px 24px; text-align: center;">
              <div style="display: inline-block; background: ${gc}22; border: 2px solid ${gc}; border-radius: 16px; padding: 12px 28px; margin-bottom: 16px;">
                <span style="font-size: 48px; font-weight: 900; color: ${gc}; line-height: 1;">${grade}</span>
              </div>
              <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #ffffff;">${report.headline}</h2>
              <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.6; max-width: 460px; margin: 0 auto;">${report.summary}</p>
            </td>
          </tr>

          <!-- Stats row -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #1A1D2E; border-radius: 12px; border: 1px solid #2D3152; overflow: hidden;">
                <tr>
                  <td style="padding: 16px; text-align: center; border-right: 1px solid #2D3152;">
                    <p style="margin: 0 0 4px; font-size: 22px; font-weight: 800; color: #ffffff;">${stats.bets}</p>
                    <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 1px;">Bets</p>
                  </td>
                  <td style="padding: 16px; text-align: center; border-right: 1px solid #2D3152;">
                    <p style="margin: 0 0 4px; font-size: 22px; font-weight: 800; color: #ffffff;">${stats.win_rate}</p>
                    <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 1px;">Win Rate</p>
                  </td>
                  <td style="padding: 16px; text-align: center; border-right: 1px solid #2D3152;">
                    <p style="margin: 0 0 4px; font-size: 22px; font-weight: 800; color: ${pnlColor(stats.pnl)};">${pnlStr}</p>
                    <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 1px;">P&L</p>
                  </td>
                  <td style="padding: 16px; text-align: center;">
                    <p style="margin: 0 0 4px; font-size: 22px; font-weight: 800; color: ${pnlColor(parseFloat(stats.roi))};">${stats.roi}%</p>
                    <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 1px;">ROI</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Strengths -->
          <tr>
            <td style="padding: 0 24px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #0d1a0d; border: 1px solid #1a3a1a; border-radius: 12px; padding: 16px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 12px; font-size: 12px; font-weight: 700; color: #00C896; text-transform: uppercase; letter-spacing: 1.5px;">✅ Strengths</p>
                    ${report.strengths.map(s => `<p style="margin: 0 0 6px; font-size: 14px; color: rgba(255,255,255,0.8);">• ${s}</p>`).join('')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Improvements -->
          <tr>
            <td style="padding: 0 24px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #1a0d0d; border: 1px solid #3a1a1a; border-radius: 12px; padding: 16px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 12px; font-size: 12px; font-weight: 700; color: #FF4757; text-transform: uppercase; letter-spacing: 1.5px;">📈 Areas to Improve</p>
                    ${report.improvements.map(s => `<p style="margin: 0 0 6px; font-size: 14px; color: rgba(255,255,255,0.8);">• ${s}</p>`).join('')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tip for next week -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #0d1228; border: 1px solid #1e2a5e; border-radius: 12px; padding: 16px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; color: #3B5BDB; text-transform: uppercase; letter-spacing: 1.5px;">💡 Coach's Tip for Next Week</p>
                    <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.9); line-height: 1.6; font-style: italic;">"${report.tip_for_next_week}"</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Upgrade CTA (free users only) -->
          ${upgradeSection}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 24px 32px; text-align: center;">
              <a href="${appUrl}/dashboard" style="display: inline-block; background: #3B5BDB; color: #ffffff; font-weight: 700; font-size: 15px; padding: 14px 36px; border-radius: 8px; text-decoration: none;">
                View Full Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 24px; text-align: center; border-top: 1px solid #1e2540;">
              <p style="margin: 0 0 4px; font-size: 12px; color: rgba(255,255,255,0.3);">BetIQ — AI Betting Coach ⚽</p>
              <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.2);">
                You received this because you have an account at footballbetai.vercel.app.<br/>
                <a href="${appUrl}/settings" style="color: rgba(255,255,255,0.3); text-decoration: underline;">Manage email preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html }
}
