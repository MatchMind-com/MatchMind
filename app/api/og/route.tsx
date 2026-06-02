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
 * IMPORTANT — Satori constraints (the renderer behind ImageResponse):
 *   - Every parent must use display: 'flex' (or 'none')
 *   - Multi-child parents need an explicit flexDirection
 *   - Text content must live inside its own element (no mixed text+spans
 *     at a single level)
 *   - position: 'absolute' children need their parent to be 'relative'
 *   - Use only system fonts unless we ship a custom font file
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

async function getValueBetCount(): Promise<number> {
  try {
    const res = await fetch(`${APP_URL}/api/predictions`, { cache: 'no-store' })
    const json = await res.json()
    const preds: any[] = Array.isArray(json?.predictions) ? json.predictions : []
    return preds.filter((p) => p?.is_value_bet === true || (p?.value_score != null && p.value_score > 0)).length
  } catch {
    return 0
  }
}

export async function GET() {
  let valueBetCount = 0
  try {
    valueBetCount = await getValueBetCount()
  } catch {
    // Fall through with 0 — card still renders
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0B0B14',
          padding: '80px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top brand row */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <div
            style={{
              width: 72,
              height: 72,
              background: '#F97316',
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 44,
              fontWeight: 900,
              marginRight: 20,
            }}
          >
            M
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: 'white', fontSize: 38, fontWeight: 800 }}>MatchMind</div>
            <div style={{ color: '#94A3B8', fontSize: 18, fontWeight: 500, marginTop: 4 }}>
              FOOTBALL INTELLIGENCE
            </div>
          </div>
        </div>

        {/* Headline — two simple lines, no nested spans */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 70 }}>
          <div style={{ color: 'white', fontSize: 84, fontWeight: 900, lineHeight: 1.05 }}>
            See the edge
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline' }}>
            <div style={{ color: 'white', fontSize: 84, fontWeight: 900, lineHeight: 1.05 }}>
              before&nbsp;
            </div>
            <div style={{ color: '#F97316', fontSize: 84, fontWeight: 900, lineHeight: 1.05 }}>
              kickoff
            </div>
            <div style={{ color: 'white', fontSize: 84, fontWeight: 900, lineHeight: 1.05 }}>
              .
            </div>
          </div>
        </div>

        {/* Sub-stats row */}
        <div style={{ display: 'flex', flexDirection: 'row', marginTop: 60 }}>
          <div style={{ display: 'flex', flexDirection: 'column', marginRight: 60 }}>
            <div style={{ color: '#F97316', fontSize: 72, fontWeight: 900, lineHeight: 1 }}>
              {valueBetCount}
            </div>
            <div style={{ color: '#94A3B8', fontSize: 18, fontWeight: 600, marginTop: 8 }}>
              VALUE BETS TODAY
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginRight: 60 }}>
            <div style={{ color: 'white', fontSize: 72, fontWeight: 900, lineHeight: 1 }}>
              25
            </div>
            <div style={{ color: '#94A3B8', fontSize: 18, fontWeight: 600, marginTop: 8 }}>
              LEAGUES
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: 'white', fontSize: 72, fontWeight: 900, lineHeight: 1 }}>
              43%
            </div>
            <div style={{ color: '#94A3B8', fontSize: 18, fontWeight: 600, marginTop: 8 }}>
              VALUE-BET WIN RATE
            </div>
          </div>
        </div>

        {/* Footer URL — pinned to bottom via margin-top: auto */}
        <div style={{ display: 'flex', marginTop: 'auto' }}>
          <div style={{ color: '#94A3B8', fontSize: 22, fontWeight: 600 }}>matchmindcom.com</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=1800, stale-while-revalidate=3600',
      },
    },
  )
}
