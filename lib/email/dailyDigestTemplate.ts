interface ValueBet {
  home_team: string
  away_team: string
  league: string
  bet_type: string
  odds: number | null
  ev_percent: number | null
  kick_off: string
  is_value_bet: boolean
}

function evColor(ev: number | null): string {
  if (!ev) return '#6B7280'
  if (ev >= 15) return '#00C896'
  if (ev >= 8) return '#10B981'
  return '#6EE7B7'
}

function formatKickOff(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
  } catch { return '' }
}

function betCard(bet: ValueBet, isPro: boolean): string {
  const ev = bet.ev_percent
  const odds = bet.odds ? bet.odds.toFixed(2) : '—'
  const kickOff = formatKickOff(bet.kick_off)
  const evStr = ev ? `+${ev}% EV` : ''
  const evCol = evColor(ev)
  const blurOdds = !isPro

  return `
    <tr>
      <td style="padding: 0 0 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #161B26; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="padding: 14px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 2px 0; font-size: 13px; font-weight: 700; color: #FFFFFF;">${bet.home_team} vs ${bet.away_team}</p>
                    <p style="margin: 0; font-size: 11px; color: #6B7280;">${bet.league}${kickOff ? ` · KO ${kickOff}` : ''}</p>
                  </td>
                  ${evStr ? `<td align="right" style="vertical-align: top;">
                    <span style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 20px; padding: 2px 8px; font-size: 11px; font-weight: 700; color: ${evCol};">${evStr}</span>
                  </td>` : ''}
                </tr>
                <tr>
                  <td style="padding-top: 10px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background: rgba(59,91,219,0.15); border: 1px solid rgba(59,91,219,0.3); border-radius: 8px; padding: 4px 10px; margin-right: 8px;">
                          <span style="font-size: 11px; font-weight: 700; color: #93BBFD;">${bet.bet_type}</span>
                        </td>
                        <td width="8"></td>
                        <td>
                          ${blurOdds
                            ? `<span style="font-size: 13px; font-weight: 900; color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); border-radius: 4px; padding: 2px 6px; letter-spacing: 2px;">●●●</span>`
                            : `<span style="font-size: 14px; font-weight: 900; color: #F97316;">@ ${odds}</span>`
                          }
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `
}

export function buildDailyDigestEmail(opts: {
  username: string
  bets: ValueBet[]
  date: string
  subscriptionTier: 'free' | 'pro' | 'elite'
  appUrl: string
}): { subject: string; html: string } {
  const { username, bets, date, subscriptionTier, appUrl } = opts
  const isPro = subscriptionTier === 'pro' || subscriptionTier === 'elite'
  const count = bets.length

  const subject = `⚡ ${count} Value Bet${count !== 1 ? 's' : ''} Today — MatchMind AI · ${date}`

  const cards = bets.map(b => betCard(b, isPro)).join('')

  const upgradeBlock = !isPro ? `
    <tr>
      <td style="padding: 0 24px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(59,91,219,0.2) 0%, rgba(249,115,22,0.1) 100%); border: 1px solid rgba(249,115,22,0.3); border-radius: 12px; padding: 16px 20px;">
          <tr>
            <td>
              <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #FFFFFF;">Unlock real odds & full analysis</p>
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #9CA3AF;">Pro shows exact bookmaker odds, EV% breakdowns, and AI reasoning for every bet.</p>
              <a href="${appUrl}/api/stripe/create-checkout?plan=pro" style="display: inline-block; background: #F97316; color: #FFFFFF; font-size: 12px; font-weight: 800; text-decoration: none; padding: 8px 20px; border-radius: 8px;">
                Upgrade to Pro — £9.99/mo →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : ''

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #060914; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #060914;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">

          <!-- Header -->
          <tr>
            <td style="padding: 0 0 24px 0;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.25); border-radius: 12px; padding: 8px 16px;" align="center">
                    <span style="font-size: 18px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.5px;">Match<span style="color: #F97316;">Mind</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title block -->
          <tr>
            <td style="background: linear-gradient(135deg, rgba(249,115,22,0.08) 0%, #0D1117 60%); border: 1px solid rgba(249,115,22,0.2); border-radius: 16px; padding: 20px 24px 16px; margin-bottom: 16px;">
              <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: #F97316; text-transform: uppercase; letter-spacing: 1px;">⚡ Daily Value Bets · ${date}</p>
              <p style="margin: 0 0 8px 0; font-size: 22px; font-weight: 900; color: #FFFFFF; line-height: 1.2;">
                ${count} Value Bet${count !== 1 ? 's' : ''} Found Today
              </p>
              <p style="margin: 0; font-size: 13px; color: #6B7280;">
                Hi ${username} 👋 — our AI found <strong style="color: #D1D5DB;">${count} positive EV pick${count !== 1 ? 's' : ''}</strong> for today. These are bets where the bookmaker's odds undervalue the real probability.
              </p>
            </td>
          </tr>

          <tr><td height="16"></td></tr>

          <!-- Bet cards -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${cards}
              </table>
            </td>
          </tr>

          ${upgradeBlock}

          <!-- CTA -->
          <tr>
            <td style="padding: 4px 0 20px;" align="center">
              <a href="${appUrl}/dashboard/predictions" style="display: inline-block; background: #161B26; border: 1px solid rgba(255,255,255,0.1); color: #FFFFFF; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
                View Full Analysis →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px;" align="center">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #374151;">
                MatchMind AI · <a href="${appUrl}/dashboard/settings" style="color: #4B5563; text-decoration: underline;">Manage email preferences</a>
              </p>
              <p style="margin: 0; font-size: 10px; color: #374151;">
                18+ · Gamble responsibly · <a href="https://www.begambleaware.org" style="color: #4B5563;">BeGambleAware.org</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  return { subject, html }
}
