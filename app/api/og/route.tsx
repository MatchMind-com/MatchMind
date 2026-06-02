/**
 * GET /api/og
 *
 * Site-wide Open Graph image — renders the default 1200×630 brand card
 * used as the share preview for every MatchMind link (when no
 * page-specific OG image is set).
 *
 * Before this existed: shared links rendered with no preview card,
 * looking unbranded and skip-worthy on Twitter, IG DMs, WhatsApp,
 * Slack, etc.
 *
 * Live data: pulls today's value-bet count from /api/predictions so the
 * card always shows "N value bets live today" — a freshness signal.
 *
 * Edge runtime — sub-second generation, cached on Vercel CDN.
 *
 * Note: Vercel OG uses Satori under the hood which requires inline styles
 * (no CSS classes) and basic flex layout.
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

async function getValueBetCount(): Promise<number> {
  try {
    const res = await fetch(`${APP_URL}/api/predictions`, { cache: 'no-store' })
    const json = await res.json()
    const preds: any[] = Array.isArray(json?.predictions) ? json.predictions : []
    // Count picks the user would see as +EV value bets (matches the UI's filter)
    return preds.filter((p) => p?.is_value_bet === true || (p?.value_score != null && p.value_score > 0)).length
  } catch {
    return 0
  }
}

export async function GET() {
  const valueBetCount = await getValueBetCount()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0B0B14 0%, #131326 50%, #1f1532 100%)',
          padding: '80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Top brand row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              background: 'linear-gradient(135deg, #FF6B35 0%, #F97316 100%)',
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 38,
              fontWeight: 900,
              boxShadow: '0 8px 30px rgba(249, 115, 22, 0.45)',
            }}
          >
            M
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: 'white', fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em' }}>
              MatchMind
            </div>
            <div style={{ color: '#94A3B8', fontSize: 18, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              Football Intelligence
            </div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ marginTop: 70, display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: 'white', fontSize: 84, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            See the edge
          </div>
          <div style={{ color: 'white', fontSize: 84, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            before <span style={{ color: '#F97316' }}>kickoff</span>.
          </div>
        </div>

        {/* Sub-stats row */}
        <div
          style={{
            marginTop: 60,
            display: 'flex',
            gap: 60,
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: '#F97316', fontSize: 72, fontWeight: 900, lineHeight: 1 }}>
              {valueBetCount}
            </div>
            <div style={{ color: '#94A3B8', fontSize: 18, fontWeight: 600, marginTop: 8, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Value bets today
            </div>
          </div>
          <div style={{ width: 1, height: 80, background: '#334155' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: 'white', fontSize: 72, fontWeight: 900, lineHeight: 1 }}>
              25
            </div>
            <div style={{ color: '#94A3B8', fontSize: 18, fontWeight: 600, marginTop: 8, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Leagues
            </div>
          </div>
          <div style={{ width: 1, height: 80, background: '#334155' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: 'white', fontSize: 72, fontWeight: 900, lineHeight: 1 }}>
              43%
            </div>
            <div style={{ color: '#94A3B8', fontSize: 18, fontWeight: 600, marginTop: 8, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Value-bet win rate
            </div>
          </div>
        </div>

        {/* Footer URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            left: 80,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ color: '#94A3B8', fontSize: 22, fontWeight: 600 }}>
            matchmindcom.com
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      // Edge cache: serve the same card for 30 min, then re-render with
      // updated value-bet count. Long enough to absorb share traffic,
      // short enough that the headline stat stays fresh.
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=1800, stale-while-revalidate=3600',
      },
    },
  )
}
