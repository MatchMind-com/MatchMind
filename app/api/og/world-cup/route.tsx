/**
 * GET /api/og/world-cup
 *
 * Tournament-specific Open Graph share card for /world-cup. Used as the
 * preview image when the page is shared on TikTok bio links, Twitter,
 * IG DMs, WhatsApp, Slack, etc.
 *
 * Live data: countdown to kickoff (Mexico v South Africa, June 11).
 * 1-hour CDN cache so the countdown updates daily without re-rendering
 * on every share.
 *
 * Edge runtime, mirrors the proven layout pattern from /api/og/acca.
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const WORLD_CUP_KICKOFF = new Date('2026-06-11T19:00:00+00:00').getTime()

function daysUntilKickoff(): number {
  const ms = WORLD_CUP_KICKOFF - Date.now()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

export async function GET(_req: NextRequest) {
  const days = daysUntilKickoff()
  const isLive = days === 0

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
        {/* Top: tournament badge + MatchMind brand */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#F97316',
              color: 'white',
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: 3,
              padding: '8px 16px',
              borderRadius: 999,
            }}
          >
            <span>FIFA WORLD CUP 2026</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                backgroundColor: '#F97316',
                borderRadius: 10,
                marginRight: 12,
                fontSize: 24,
                fontWeight: 900,
                color: 'white',
              }}
            >
              <span>M</span>
            </div>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#F5F1E8' }}>MatchMind</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 50 }}>
          <span style={{ fontSize: 72, fontWeight: 900, color: '#F5F1E8', lineHeight: 1.05 }}>
            Every match.
          </span>
          <span style={{ fontSize: 72, fontWeight: 900, color: '#F97316', lineHeight: 1.05 }}>
            AI-analysed.
          </span>
          <span style={{ fontSize: 72, fontWeight: 900, color: '#F5F1E8', lineHeight: 1.05 }}>
            Free every day.
          </span>
        </div>

        {/* Spacer */}
        <div style={{ display: 'flex', flex: 1 }} />

        {/* Countdown */}
        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 30 }}>
          {isLive ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 64, fontWeight: 900, color: '#F97316', lineHeight: 1 }}>
                LIVE NOW
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#9CA3AF', letterSpacing: 2, marginTop: 10 }}>
                TOURNAMENT IN PROGRESS
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', marginRight: 60 }}>
              <span style={{ fontSize: 96, fontWeight: 900, color: '#F97316', lineHeight: 1 }}>
                {days}
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#9CA3AF', letterSpacing: 2, marginTop: 10 }}>
                {days === 1 ? 'DAY' : 'DAYS'} UNTIL KICKOFF
              </span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', marginRight: 60 }}>
            <span style={{ fontSize: 72, fontWeight: 900, color: '#F5F1E8', lineHeight: 1 }}>
              48
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#9CA3AF', letterSpacing: 2, marginTop: 10 }}>
              TEAMS
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 72, fontWeight: 900, color: '#F5F1E8', lineHeight: 1 }}>
              104
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#9CA3AF', letterSpacing: 2, marginTop: 10 }}>
              MATCHES
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex' }}>
          <span style={{ fontSize: 22, color: '#9CA3AF', fontWeight: 600 }}>
            matchmindcom.com/world-cup
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // 1-hour cache: countdown updates daily, so 1h fresh + 6h SWR is fine
        'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=21600',
      },
    },
  )
}
