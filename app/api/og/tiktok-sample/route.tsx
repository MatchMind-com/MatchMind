/**
 * GET /api/og/tiktok-sample
 *
 * Renders a single 1080×1920 vertical (TikTok-aspect) brand frame so
 * the user can SEE what the faceless brand template should look like.
 *
 * Used as the visual reference for CapCut text overlays — match these
 * exact colors, sizes, and spacing on every video so the brand becomes
 * the recognition signal that replaces the founder's face.
 *
 * This is a STATIC mockup frame (not generated per-video) — purpose is
 * to lock down the brand specification, not to serve as the actual
 * thumbnail for any one TikTok.
 *
 * Edge runtime, 24h cache (this almost never needs to change).
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
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
          padding: '80px 60px',
          color: '#F5F1E8',
          position: 'relative',
        }}
      >
        {/* Top: brand mark */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 90,
              height: 90,
              backgroundColor: '#F97316',
              borderRadius: 22,
              fontSize: 56,
              fontWeight: 900,
              color: 'white',
              marginBottom: 16,
            }}
          >
            <span>M</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 5, color: '#9CA3AF' }}>
            AI FOOTBALL INTELLIGENCE
          </span>
        </div>

        {/* Mid: spacer */}
        <div style={{ display: 'flex', flex: 1 }} />

        {/* Center: the key beat of the video — a stat reveal */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: '#F5F1E8', textAlign: 'center', marginBottom: 30 }}>
            PSG VS ARSENAL
          </span>
          <span style={{ fontSize: 30, fontWeight: 600, color: '#9CA3AF', marginBottom: 80 }}>
            Over 2.5 @ 2.05
          </span>

          {/* The hero number — the orange accent that draws the eye */}
          <span
            style={{
              fontSize: 280,
              fontWeight: 900,
              color: '#F97316',
              lineHeight: 1,
              letterSpacing: -8,
            }}
          >
            +23%
          </span>
          <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: 4, color: '#F5F1E8', marginTop: 24 }}>
            EDGE
          </span>
        </div>

        {/* Bottom: spacer */}
        <div style={{ display: 'flex', flex: 1 }} />

        {/* Bottom: CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: '#F5F1E8' }}>
            matchmindcom.com/world-cup
          </span>
          <span style={{ fontSize: 22, fontWeight: 600, color: '#F97316', marginTop: 8, letterSpacing: 2 }}>
            LINK IN BIO →
          </span>
        </div>

        {/* Corner watermark — bottom-right of every video */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            right: 60,
            display: 'flex',
            fontSize: 20,
            fontWeight: 600,
            color: 'rgba(245, 241, 232, 0.4)',
          }}
        >
          <span>@match.mindai</span>
        </div>

        {/* Spec callouts — only on this sample frame, NOT on real videos */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            fontSize: 16,
            fontWeight: 500,
            color: 'rgba(245, 241, 232, 0.35)',
          }}
        >
          <span>1080 × 1920 · 9:16</span>
          <span>BG #0F1115 · ACCENT #F97316</span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}
