/**
 * GET /api/og/pick?id={fixtureId}
 *
 * Per-pick share OG card — 1200×630 (Twitter/IG link preview spec).
 * Designed for TikTok bio drops: short URLs like
 *   matchmindcom.com/share/pick/{fixtureId}
 * unfurl into a beautiful preview.
 *
 * Edge runtime + CDN cached.
 *
 * Satori-friendly: explicit widths on text spans, fixed heights on
 * sections, no marginTop:'auto' / flexGrow / grid (none of those are
 * supported by Satori and they all caused layout collapse on the
 * previous version).
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

interface Prediction {
  id: number
  home_team: string
  away_team: string
  league: string
  date?: string
  best_value?: { ev?: number; odds?: number; label?: string; category?: string }
  recommended_bet?: string
  recommended_odds_range?: string
  is_value_bet?: boolean
}

function parseOdds(s: string | undefined): number | null {
  if (!s) return null
  const m = s.match(/[\d.]+/)
  if (!m) return null
  const n = parseFloat(m[0])
  return Number.isFinite(n) && n > 1 ? n : null
}

function fmtKickoff(iso: string | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/London',
    }) + ' BST'
  } catch {
    return ''
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const idParam = searchParams.get('id')
  const id = idParam ? parseInt(idParam, 10) : NaN

  let pick: Prediction | null = null
  try {
    const res = await fetch(`${APP_URL}/api/predictions`, { cache: 'no-store' })
    const json = await res.json()
    const preds = Array.isArray(json?.predictions) ? (json.predictions as Prediction[]) : []
    if (Number.isFinite(id)) {
      pick = preds.find(p => p.id === id) ?? null
    }
  } catch {}

  const label = pick?.best_value?.label ?? pick?.recommended_bet ?? null
  const odds = pick?.best_value?.odds ?? parseOdds(pick?.recommended_odds_range)
  const ev = pick?.best_value?.ev ?? null
  const showFull = !!(pick && label && odds && pick.is_value_bet !== false)

  const bg = '#0F1115'
  const fg = '#F5F1E8'
  const fgMuted = '#6E6B62'
  const brand = '#F97316'
  const success = '#10B981'

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630, display: 'flex', flexDirection: 'column',
          background: bg, color: fg, padding: '52px 64px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Top bar — fixed height */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', color: fg }}>
              MATCH<span style={{ color: brand }}>MIND</span>
            </span>
            <span style={{ fontSize: 11, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em', marginTop: 3 }}>
              AI FOOTBALL INTELLIGENCE
            </span>
          </div>
          {showFull && pick && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em' }}>
                {pick.league.toUpperCase()}
              </span>
              {pick.date && (
                <span style={{ fontSize: 16, color: fgMuted, marginTop: 4 }}>
                  {fmtKickoff(pick.date)}
                </span>
              )}
            </div>
          )}
        </div>

        {showFull && pick ? (
          <>
            {/* Matchup — width:1072 forces column-stack vs siblings */}
            <div style={{ display: 'flex', flexDirection: 'column', width: "100%", marginTop: 36 }}>
              <span style={{ fontSize: 60, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, color: fg }}>
                {pick.home_team}
              </span>
              <span style={{ fontSize: 22, color: fgMuted, fontWeight: 700, marginTop: 4 }}>
                vs
              </span>
              <span style={{ fontSize: 60, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, color: fg, marginTop: 4 }}>
                {pick.away_team}
              </span>
            </div>

            {/* Pick block — single column, width:1072 */}
            <div style={{
              display: 'flex', flexDirection: 'column', width: "100%", marginTop: 32,
              borderTop: `1px solid ${fgMuted}55`, padding: '20px 0',
            }}>
              <span style={{ fontSize: 11, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em' }}>
                AI PICK
              </span>
              <span style={{ fontSize: 32, fontWeight: 900, marginTop: 6, letterSpacing: '-0.02em', color: fg }}>
                {label} <span style={{ color: brand, marginLeft: 16 }}>@ {odds!.toFixed(2)}</span>
                {ev !== null && (
                  <span style={{ color: success, marginLeft: 16 }}>+{ev}% EV</span>
                )}
              </span>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', width: "100%", marginTop: 24 }}>
              <span style={{ fontSize: 16, color: fgMuted }}>
                matchmindcom.com · Every pick logged before kick-off · every result public · 18+
              </span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 60 }}>
            <span style={{ fontSize: 110, fontWeight: 900, letterSpacing: '-0.05em', color: fg, lineHeight: 1 }}>Find</span>
            <span style={{ fontSize: 110, fontWeight: 900, letterSpacing: '-0.05em', color: fg, lineHeight: 1, marginTop: 4 }}>the</span>
            <span style={{ fontSize: 110, fontWeight: 900, letterSpacing: '-0.05em', color: brand, lineHeight: 1, marginTop: 4 }}>edge.</span>
            <div style={{ display: 'flex', marginTop: 28 }}>
              <span style={{ fontSize: 22, color: fgMuted, width: 1072 }}>
                AI value bets across 25 leagues · matchmindcom.com
              </span>
            </div>
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
