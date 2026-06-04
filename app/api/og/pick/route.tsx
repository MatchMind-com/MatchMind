/**
 * GET /api/og/pick?id={fixtureId}
 *
 * Per-pick share OG card — 1200x630 (Twitter/IG link preview spec).
 * Designed for TikTok bio drops: short URLs like
 *   matchmindcom.com/share/pick/{fixtureId}
 * unfurl into a beautiful preview with the team matchup, the pick,
 * the odds, and the EV.
 *
 * Looks up the pick from /api/predictions (live cache) and falls back
 * to a generic "find the edge" card if the fixture has no value bet
 * or the cache is cold.
 *
 * Edge runtime — fast generation + CDN-cached.
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
  leagueFlag?: string
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
  } catch {
    // empty-state below
  }

  // Resolve label / odds / ev (use best_value first, then recommended)
  const label = pick?.best_value?.label ?? pick?.recommended_bet ?? null
  const odds = pick?.best_value?.odds ?? parseOdds(pick?.recommended_odds_range)
  const ev = pick?.best_value?.ev ?? null
  const showFull = !!(pick && label && odds && pick.is_value_bet !== false)

  // ── Colour tokens (must inline for Edge runtime — no Tailwind) ──
  const bg = '#0F1115'
  const fg = '#F5F1E8'
  const fgMuted = '#6E6B62'
  const brand = '#F97316'
  const success = '#10B981'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: bg, color: fg, padding: '60px 72px', fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Top row: wordmark + eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.04em' }}>
              MATCH<span style={{ color: brand }}>MIND</span>
            </span>
            <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 4 }}>
              AI Football Intelligence
            </span>
          </div>
          {showFull ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                {pick!.league}
              </span>
              {pick!.date && (
                <span style={{ fontSize: 16, color: fgMuted, marginTop: 4 }}>
                  {fmtKickoff(pick!.date)}
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 14, color: brand, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Find the edge
            </span>
          )}
        </div>

        {showFull ? (
          <>
            {/* Match-up — huge type */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 24, marginBottom: 36 }}>
              <span style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {pick!.home_team}
              </span>
              <span style={{ fontSize: 32, color: fgMuted, fontWeight: 700 }}>vs</span>
              <span style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {pick!.away_team}
              </span>
            </div>

            {/* Pick / odds / EV row */}
            <div
              style={{
                display: 'flex', alignItems: 'stretch', borderTop: `1px solid ${fgMuted}40`,
                borderBottom: `1px solid ${fgMuted}40`, paddingTop: 28, paddingBottom: 28, marginTop: 16,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  AI pick
                </span>
                <span style={{ fontSize: 38, fontWeight: 900, marginTop: 6, letterSpacing: '-0.02em' }}>
                  {label}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingLeft: 28, paddingRight: 28, borderLeft: `1px solid ${fgMuted}40` }}>
                <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  Odds
                </span>
                <span style={{ fontSize: 56, fontWeight: 900, color: brand, marginTop: 2, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {odds!.toFixed(2)}
                </span>
              </div>
              {ev !== null && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingLeft: 28, borderLeft: `1px solid ${fgMuted}40` }}>
                  <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                    Edge
                  </span>
                  <span style={{ fontSize: 56, fontWeight: 900, color: success, marginTop: 2, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                    +{ev}%
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 32 }}>
              <span style={{ fontSize: 18, color: fgMuted }}>
                Every pick logged · every result public · matchmindcom.com
              </span>
              <span style={{ fontSize: 14, color: fgMuted, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', border: `1px solid ${brand}`, color: brand, padding: '10px 18px' }}>
                18+ · No advice
              </span>
            </div>
          </>
        ) : (
          /* Fallback: generic brand card */
          <>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 60 }}>
              <span style={{ fontSize: 110, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1, color: fg }}>Find</span>
              <span style={{ fontSize: 110, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1, color: fg }}>the</span>
              <span style={{ fontSize: 110, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1, color: brand }}>edge.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', paddingTop: 40 }}>
              <span style={{ fontSize: 22, color: fgMuted }}>
                AI value bets across 25 leagues · matchmindcom.com
              </span>
            </div>
          </>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}
