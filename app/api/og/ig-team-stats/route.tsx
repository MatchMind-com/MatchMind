/**
 * GET /api/og/ig-team-stats?league={leagueName}
 *
 * "Most predictable teams" IG infographic — 1080×1350. Borrows the
 * @footballodds.io format (Bayern 80.7% etc) but uses our real data:
 * teams ranked by our AI's win-rate when picking on their matches.
 *
 * If no league specified, uses overall track record across all leagues.
 * Defaults to top 6 teams.
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const W = 1080, H = 1350, PADX = 64

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface TeamRow {
  team: string
  picks: number
  wins: number
  winRate: number
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const leagueFilter = searchParams.get('league')

  const query = supabase
    .from('prediction_records')
    .select('home_team, away_team, result, league')
    .not('result', 'is', null)
    .eq('is_value_bet', true)
  if (leagueFilter) query.eq('league', leagueFilter)
  const { data } = await query.limit(2000)

  // Aggregate per team — count picks where the team was the SUBJECT
  // (home or away) of an AI value bet and the bet hit
  const agg: Record<string, { picks: number; wins: number }> = {}
  for (const r of (data ?? []) as Array<{ home_team: string; away_team: string; result: string }>) {
    for (const t of [r.home_team, r.away_team]) {
      if (!t) continue
      agg[t] = agg[t] || { picks: 0, wins: 0 }
      agg[t].picks++
      if (r.result === 'win') agg[t].wins++
    }
  }
  const rows: TeamRow[] = Object.entries(agg)
    .filter(([, v]) => v.picks >= 3)   // need enough sample
    .map(([team, v]) => ({ team, picks: v.picks, wins: v.wins, winRate: Math.round((v.wins / v.picks) * 100) }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 6)

  const bg = '#0F1115', fg = '#F5F1E8', fgMuted = '#6E6B62'
  const brand = '#F97316', success = '#10B981'

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: 'flex', background: bg, color: fg,
        position: 'relative', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {/* Brand */}
        <div style={{ position: 'absolute', top: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em' }}>
            MATCH<span style={{ color: brand }}>MIND</span>
          </span>
          <span style={{ fontSize: 12, color: fgMuted, fontWeight: 700, letterSpacing: '0.18em', marginTop: 4 }}>
            REAL DATA · {leagueFilter ? leagueFilter.toUpperCase() : 'ACROSS 25 LEAGUES'}
          </span>
        </div>

        {/* Diagonal accent */}
        <div style={{ position: 'absolute', top: 165, left: PADX, width: 80, height: 4, background: brand, display: 'flex' }} />

        {/* Headline */}
        <div style={{ position: 'absolute', top: 195, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 78, fontWeight: 900, letterSpacing: '-0.04em', color: fg, lineHeight: 1 }}>
            Most predictable
          </span>
          <span style={{ fontSize: 78, fontWeight: 900, letterSpacing: '-0.04em', color: brand, lineHeight: 1, marginTop: 8 }}>
            teams.
          </span>
          <span style={{ fontSize: 20, color: fgMuted, marginTop: 22 }}>
            When MatchMind picks ON their matches, hit rate over last 60 days.
          </span>
        </div>

        {/* Team rows */}
        {rows.length > 0 ? (
          <div style={{
            position: 'absolute', top: 470, left: PADX, width: W - PADX * 2,
            display: 'flex', flexDirection: 'column',
          }}>
            {rows.map((r, i) => {
              const isTop = i === 0
              return (
                <div
                  key={r.team}
                  style={{
                    display: 'flex', alignItems: 'center', height: 100,
                    borderBottom: i < rows.length - 1 ? `1px solid ${fgMuted}33` : 'none',
                  }}
                >
                  <span style={{
                    width: 60, fontSize: 36, fontWeight: 900,
                    color: isTop ? brand : fgMuted, letterSpacing: '-0.02em',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{
                    fontSize: 38, fontWeight: 800, color: fg, letterSpacing: '-0.02em',
                    flex: 1,
                  }}>
                    {r.team}
                  </span>
                  <span style={{ fontSize: 14, color: fgMuted, marginRight: 28, fontWeight: 600 }}>
                    {r.picks} picks
                  </span>
                  <span style={{
                    fontSize: 48, fontWeight: 900, color: success,
                    letterSpacing: '-0.02em', lineHeight: 1,
                  }}>
                    {r.winRate}%
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ position: 'absolute', top: 540, left: PADX, display: 'flex' }}>
            <span style={{ fontSize: 26, color: fgMuted }}>
              Not enough data yet — minimum 3 picks per team. Check back in a week.
            </span>
          </div>
        )}

        {/* Footer */}
        <div style={{ position: 'absolute', bottom: 56, left: PADX, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 22, color: fg, fontWeight: 700 }}>matchmindcom.com</span>
          <span style={{ fontSize: 14, color: fgMuted, marginTop: 6 }}>
            Every pick logged before kick-off · every result public · 18+
          </span>
        </div>
      </div>
    ),
    { width: W, height: H },
  )
}
