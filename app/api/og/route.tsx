/**
 * GET /api/og — site-wide Open Graph share card.
 *
 * Renders the default 1200×630 brand card used as the share preview
 * for every MatchMind link (when no page-specific OG image is set).
 * Without this, shared links rendered with blank previews on
 * Twitter / IG DMs / WhatsApp / Slack.
 *
 * Live data: pulls today's value-bet count from /api/predictions.
 *
 * Edge runtime, 30-min CDN cache.
 *
 * Mirrors the structure of the proven-working /api/og/acca route —
 * same flex/span patterns, same string padding, etc.
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

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

export async function GET(_req: NextRequest) {
  const valueBetCount = await getValueBetCount()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0F1115',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '60px',
          color: '#F5F1E8',
        }}
      >
        {/* Brand row */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              backgroundColor: '#F97316',
              borderRadius: 18,
              marginRight: 24,
              fontSize: 48,
              fontWeight: 900,
              color: 'white',
            }}
          >
            <span>M</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 48, fontWeight: 800, color: '#F5F1E8', lineHeight: 1 }}>
              MatchMind
            </span>
            <span style={{ fontSize: 20, color: '#F97316', fontWeight: 700, letterSpacing: 4, marginTop: 6 }}>
              FOOTBALL INTELLIGENCE
            </span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 76, fontWeight: 900, color: '#F5F1E8', lineHeight: 1.1 }}>
            See the edge
          </span>
          <span style={{ fontSize: 76, fontWeight: 900, color: '#F97316', lineHeight: 1.1 }}>
            before kickoff.
          </span>
        </div>

        {/* Spacer pushes stats + footer to bottom */}
        <div style={{ display: 'flex', flex: 1 }} />

        {/* Stats row */}
        <div style={{ display: 'flex', flexDirection: 'row', marginBottom: 30 }}>
          <div style={{ display: 'flex', flexDirection: 'column', marginRight: 70 }}>
            <span style={{ fontSize: 72, fontWeight: 900, color: '#F97316', lineHeight: 1 }}>
              {valueBetCount}
            </span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#9CA3AF', letterSpacing: 2, marginTop: 8 }}>
              VALUE BETS TODAY
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginRight: 70 }}>
            <span style={{ fontSize: 72, fontWeight: 900, color: '#F5F1E8', lineHeight: 1 }}>
              25
            </span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#9CA3AF', letterSpacing: 2, marginTop: 8 }}>
              LEAGUES
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 72, fontWeight: 900, color: '#F5F1E8', lineHeight: 1 }}>
              43%
            </span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#9CA3AF', letterSpacing: 2, marginTop: 8 }}>
              VALUE-BET WIN RATE
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex' }}>
          <span style={{ fontSize: 22, color: '#9CA3AF', fontWeight: 600 }}>
            matchmindcom.com
          </span>
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
