/**
 * /api/predictions — public cache reader
 *
 * Reads from predictions_by_league (one row per league, written by the 3 tiered crons).
 * Falls back to the legacy single-row predictions_cache if the per-league table is empty
 * (e.g., during the initial migration window).
 *
 * Always returns in <200ms regardless of Vercel plan or timeout.
 */

import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { rateLimit, getClientKey, rateLimitResponse } from '@/lib/rate-limit'

export const revalidate = 300

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Round-robin so every league gets at least one slot before any league gets a second.
function roundRobinPick<T>(perLeague: T[][], cap: number): T[] {
  const picked: T[] = []
  let round = 0
  while (picked.length < cap) {
    let added = 0
    for (const league of perLeague) {
      if (round < league.length) {
        picked.push(league[round])
        added++
        if (picked.length >= cap) break
      }
    }
    if (added === 0) break
    round++
  }
  return picked
}

export async function GET(request: Request) {
  const rl = rateLimit(`predictions:${getClientKey(request)}`, 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl.resetMs)

  try {
    const { data: leagueRows, error: leagueErr } = await supabaseAdmin
      .from('predictions_by_league')
      .select('league_id, league_name, league_flag, payload, generated_at, fixture_count, api_failures')
      .order('generated_at', { ascending: false })

    if (!leagueErr && leagueRows && leagueRows.length > 0) {
      const perLeagueArrays: any[][] = leagueRows.map(r => Array.isArray(r.payload) ? (r.payload as any[]) : [])
      // Cap at 60 — round-robin guarantees breadth across all leagues first.
      const merged = roundRobinPick(perLeagueArrays, 60)

      // Sort by value_score desc within the picked set so best bets float up.
      merged.sort((a: any, b: any) => (b?.value_score ?? -999) - (a?.value_score ?? -999))

      const oldest = leagueRows.reduce<string | null>((acc, r) => {
        if (!acc || r.generated_at < acc) return r.generated_at
        return acc
      }, null)
      const newest = leagueRows.reduce<string | null>((acc, r) => {
        if (!acc || r.generated_at > acc) return r.generated_at
        return acc
      }, null)

      const meta = {
        leagues_count: leagueRows.length,
        league_names: leagueRows.map(r => r.league_name),
        fixture_count: merged.length,
        total_available: perLeagueArrays.reduce((s, a) => s + a.length, 0),
        oldest_refresh: oldest,
        newest_refresh: newest,
        cache_generated_at: newest,
        api_failures: leagueRows.reduce((s, r) => s + (r.api_failures ?? 0), 0),
        served_from_cache: true,
        source: 'predictions_by_league',
      }

      return NextResponse.json({ success: true, predictions: merged, meta })
    }

    // Fallback: legacy single-row cache
    const { data, error } = await supabaseAdmin
      .from('predictions_cache')
      .select('payload, generated_at, fixture_count, leagues_count')
      .eq('id', 1)
      .single()

    if (error || !data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Predictions are being generated. Please check back in a few minutes.',
          cache_miss: true,
        },
        { status: 503 }
      )
    }

    const payload = data.payload as any
    const enriched = {
      ...payload,
      meta: {
        ...(payload.meta ?? {}),
        cache_generated_at: data.generated_at,
        fixture_count: data.fixture_count,
        leagues_count: data.leagues_count,
        served_from_cache: true,
        source: 'predictions_cache_legacy',
      },
    }

    return NextResponse.json(enriched)
  } catch (err: any) {
    console.error('[predictions] DB read error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to load predictions' },
      { status: 500 }
    )
  }
}
