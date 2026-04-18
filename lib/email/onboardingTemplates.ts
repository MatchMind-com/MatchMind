const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

// ─── Day 1: Welcome ───────────────────────────────────────────────────────────

export function buildDay1Email(params: { email: string; name?: string }): { subject: string; html: string } {
  const name = params.name || 'there'
  const subject = '⚡ Welcome to MatchMind — here\'s how to get your edge'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B0B14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ffffff;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">

    <!-- Logo -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:36px;">
      <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#7C3AED,#4F46E5);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:#fff;">B</div>
      <span style="font-weight:700;font-size:16px;color:#fff;">MatchMind</span>
    </div>

    <!-- Hero -->
    <div style="background:#12121F;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px;margin-bottom:24px;">
      <p style="font-size:28px;font-weight:900;margin:0 0 12px;line-height:1.2;">Hey ${name} 👋</p>
      <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.6;margin:0 0 20px;">
        You're now on your <strong style="color:#a78bfa;">7-day free Pro trial</strong>.
        You've got full access to everything — AI predictions, value bets, the acca builder, and the football coach.
        No credit card needed, no tricks.
      </p>
      <a href="${APP_URL}/dashboard/predictions" style="display:inline-block;background:#7C3AED;color:#fff;font-weight:700;font-size:14px;padding:13px 24px;border-radius:12px;text-decoration:none;">
        See Today's Value Bets →
      </a>
    </div>

    <!-- 3 steps -->
    <p style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 12px;">Start here</p>
    <div style="space-y:12px;">
      ${[
        { step: '1', icon: '🔮', title: 'Check today\'s AI predictions', desc: 'Value bets are generated fresh each day with EV%, confidence, and live Bet365 odds.', href: `${APP_URL}/dashboard/predictions` },
        { step: '2', icon: '🤖', title: 'Ask the AI Football Coach', desc: 'Chat with GPT-4o about any match — injuries, form, why the AI rated a bet.', href: `${APP_URL}/dashboard/coach` },
        { step: '3', icon: '📊', title: 'Start tracking your bets', desc: 'Log what you place and get weekly report cards showing your ROI and patterns.', href: `${APP_URL}/dashboard/bankroll` },
      ].map(s => `
      <div style="display:flex;gap:14px;align-items:flex-start;background:#12121F;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:18px;margin-bottom:10px;">
        <div style="width:32px;height:32px;border-radius:10px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.25);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${s.icon}</div>
        <div>
          <p style="margin:0 0 4px;font-weight:700;font-size:14px;">${s.title}</p>
          <p style="margin:0 0 10px;color:rgba(255,255,255,0.4);font-size:13px;line-height:1.5;">${s.desc}</p>
          <a href="${s.href}" style="color:#a78bfa;font-size:13px;font-weight:600;text-decoration:none;">Get started →</a>
        </div>
      </div>
      `).join('')}
    </div>

    <!-- Footer -->
    <p style="color:rgba(255,255,255,0.2);font-size:12px;text-align:center;margin-top:32px;line-height:1.6;">
      You're receiving this because you just signed up to MatchMind.<br>
      Please gamble responsibly. 18+.<br>
      <a href="${APP_URL}" style="color:rgba(255,255,255,0.3);">matchmindcom.company</a>
    </p>
  </div>
</body>
</html>`

  return { subject, html }
}

// ─── Day 3: First check-in ────────────────────────────────────────────────────

export function buildDay3Email(params: { email: string; name?: string }): { subject: string; html: string } {
  const name = params.name || 'there'
  const subject = '🎯 Day 3 — are you getting value from your predictions?'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B0B14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ffffff;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">

    <!-- Logo -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:36px;">
      <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#7C3AED,#4F46E5);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:#fff;">B</div>
      <span style="font-weight:700;font-size:16px;color:#fff;">MatchMind</span>
    </div>

    <!-- Hero -->
    <div style="background:#12121F;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px;margin-bottom:24px;">
      <p style="font-size:24px;font-weight:900;margin:0 0 12px;">How's it going, ${name}?</p>
      <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.6;margin:0 0 8px;">
        You're 3 days into your free Pro trial. A few things worth knowing before you go further:
      </p>
    </div>

    <!-- Tips -->
    <div style="margin-bottom:24px;">
      ${[
        {
          icon: '💡',
          title: 'EV% is more important than odds',
          body: 'A bet at 1.55 with +18% EV is a better bet than a 4.00 shot with +6% EV. The AI ranks picks by edge, not excitement.',
        },
        {
          icon: '📅',
          title: 'Predictions refresh every morning',
          body: 'Fresh value bets are generated daily from live lineup and injury data. Check in before 12pm for the full selection.',
        },
        {
          icon: '🎯',
          title: 'The AI Acca Builder is live',
          body: 'The system picks 2–3 positive-EV legs across different leagues and builds a verified accumulator. No junk legs.',
        },
      ].map(tip => `
      <div style="background:#12121F;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px;margin-bottom:10px;display:flex;gap:14px;align-items:flex-start;">
        <span style="font-size:22px;flex-shrink:0;">${tip.icon}</span>
        <div>
          <p style="margin:0 0 6px;font-weight:700;font-size:14px;">${tip.title}</p>
          <p style="margin:0;color:rgba(255,255,255,0.4);font-size:13px;line-height:1.55;">${tip.body}</p>
        </div>
      </div>
      `).join('')}
    </div>

    <div style="text-align:center;margin-bottom:32px;">
      <a href="${APP_URL}/dashboard" style="display:inline-block;background:#7C3AED;color:#fff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:12px;text-decoration:none;">
        Open Your Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <p style="color:rgba(255,255,255,0.2);font-size:12px;text-align:center;line-height:1.6;">
      MatchMind · Please gamble responsibly · 18+<br>
      <a href="${APP_URL}" style="color:rgba(255,255,255,0.3);">matchmindcom.company</a>
    </p>
  </div>
</body>
</html>`

  return { subject, html }
}

// ─── Day 6: Trial ending tomorrow ────────────────────────────────────────────

export function buildDay6Email(params: { email: string; name?: string }): { subject: string; html: string } {
  const name = params.name || 'there'
  const subject = '⏰ Your free Pro trial ends tomorrow'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B0B14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ffffff;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">

    <!-- Logo -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:36px;">
      <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#7C3AED,#4F46E5);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:#fff;">B</div>
      <span style="font-weight:700;font-size:16px;color:#fff;">MatchMind</span>
    </div>

    <!-- Urgency bar -->
    <div style="background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(234,88,12,0.06));border:1px solid rgba(245,158,11,0.25);border-radius:16px;padding:14px 20px;margin-bottom:24px;display:flex;align-items:center;gap:12px;">
      <span style="font-size:20px;">⏰</span>
      <p style="margin:0;font-weight:700;font-size:14px;color:#fbbf24;">Your 7-day Pro trial ends in less than 24 hours</p>
    </div>

    <!-- Hero -->
    <div style="background:#12121F;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px;margin-bottom:24px;">
      <p style="font-size:24px;font-weight:900;margin:0 0 14px;">${name}, don't lose your edge</p>
      <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.6;margin:0 0 20px;">
        After tomorrow, your account drops back to the free plan — you'll lose access to daily AI predictions,
        the acca builder, value bets, and unlimited coaching.
      </p>

      <!-- What you keep vs lose -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
        <div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.15);border-radius:12px;padding:16px;">
          <p style="margin:0 0 8px;font-weight:700;font-size:12px;color:#34d399;text-transform:uppercase;letter-spacing:0.05em;">✓ Keep with Pro</p>
          ${['Daily value bets', 'AI Acca Builder', 'All 15 leagues', 'Weekly report card', 'Unlimited AI Coach'].map(f => `<p style="margin:0 0 4px;color:rgba(255,255,255,0.6);font-size:13px;">${f}</p>`).join('')}
        </div>
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;">
          <p style="margin:0 0 8px;font-weight:700;font-size:12px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.05em;">✗ Lost on free</p>
          ${['AI predictions', 'Acca Builder', 'Value bet filter', 'Report cards', '3 Coach msgs/day only'].map(f => `<p style="margin:0 0 4px;color:rgba(255,255,255,0.25);font-size:13px;">${f}</p>`).join('')}
        </div>
      </div>

      <!-- Price reminder -->
      <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:12px;padding:16px;margin-bottom:20px;text-align:center;">
        <p style="margin:0 0 4px;font-size:28px;font-weight:900;color:#fff;">£9.99<span style="font-size:14px;font-weight:400;color:rgba(255,255,255,0.4);"> /month</span></p>
        <p style="margin:0;color:rgba(255,255,255,0.35);font-size:13px;">Less than a pint a week. Cancel any time.</p>
      </div>

      <a href="${APP_URL}/dashboard/billing" style="display:block;text-align:center;background:#7C3AED;color:#fff;font-weight:700;font-size:15px;padding:15px 24px;border-radius:12px;text-decoration:none;">
        Keep Pro — £9.99/month →
      </a>
    </div>

    <p style="color:rgba(255,255,255,0.2);font-size:13px;text-align:center;margin-bottom:32px;">
      Not ready? No worries — your bet history and stats are yours forever on the free plan.
    </p>

    <!-- Footer -->
    <p style="color:rgba(255,255,255,0.15);font-size:12px;text-align:center;line-height:1.6;">
      MatchMind · Please gamble responsibly · 18+<br>
      <a href="${APP_URL}" style="color:rgba(255,255,255,0.25);">matchmindcom.company</a>
    </p>
  </div>
</body>
</html>`

  return { subject, html }
}
