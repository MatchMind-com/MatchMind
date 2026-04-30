/**
 * /api/predictions — public cache reader (with on-demand fallback)
 *
 * Fast path (99%): read predictions_by_league (one row per league, written by
 * the 3 tiered crons), filter to future kickoffs, return.
 *
 * Fallback path: if after filtering we have <5 future picks, run an inline
 * quickfetch against the top 8 leagues using gpt-4o-mini. The result is
 * persisted back to predictions_by_league so the next request is instant.
 *
 * Hard guarantee: never returns 503 if anything at all is in cache. Even
 * stale picks beat empty.
 */

import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { rateLimit, getClientKey, rateLimitResponse } from '@/lib/rate-limit'
import { quickFetchPredictions } from '@/lib/predictions-quickfetch'
import { findLeague } from '@/lib/leagues'

export const revalidate = 300

const MIN_FUTURE_PICKS = 5

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

function isFuturePick(p: any, nowMs: number): boolean {
  const t = new Date(p?.date).getTime()
  return Number.isFinite(t) && t > nowMs
}

/**
 * Persist quickfetch predictions back to predictions_by_league so the next
 * request hits the fast path. Best-effort — don't fail the user request if
 * the write doesn't land.
 */
async function persistQuickfetch(predictions: any[]): Promise<void> {
  if (!predictions.length) return
  const byLeague: Record<number, any[]> = {}
  for (const p of predictions) {
    const lid = p?._leagueId
    if (!lid) continue
    if (!byLeague[lid]) byLeague[lid] = []
    byLeague[lid].push(p)
  }
  const generatedAt = new Date().toISOString()
  await Promise.all(
    Object.entries(byLeague).map(async ([leagueIdStr, preds]) => {
      const leagueId = parseInt(leagueIdStr, 10)
      const meta = findLeague(leagueId)
      if (!meta) return
      try {
        await supabaseAdmin.from('predictions_by_league').upsert({
          league_id: leagueId,
          league_name: meta.name,
          league_flag: meta.flag,
          payload: preds,
          generated_at: generatedAt,
          fixture_count: preds.length,
          api_failures: 0,
        }, { onConflict: 'league_id' })
      } catch (dbErr) {
        console.error(`[predictions] persist quickfetch failed for ${leagueId}:`, dbErr)
      }
    })
  )
}

export async function GET(request: Request) {
  const rl = rateLimit(`predictions:${getClientKey(request)}`, 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl.resetMs)

  const nowMs = Date.now()

  try {
    const { data: leagueRows, error: leagueErr } = await supabaseAdmin
      .from('predictions_by_league')
      .select('league_id, league_name, league_flag, payload, generated_at, fixture_count, api_failures')
      .order('generated_at', { ascending: false })

    if (!leagueErr && leagueRows && leagueRows.length > 0) {
      // Filter each league's payload to future kickoffs only — already-started
      // fixtures aren't actionable picks.
      const perLeagueArrays: any[][] = leagueRows.map(r => {
        const arr = Array.isArray(r.payload) ? (r.payload as any[]) : []
        return arr.filter(p => isFuturePick(p, nowMs))
      })

      // Cap at 60 — round-robin guarantees breadth across all leagues first.
      const merged = roundRobinPick(perLeagueArrays, 60)

      // Sort by value_score desc within the picked set so best bets float up.
      merged.sort((a: any, b: any) => (b?.value_score ?? -999) - (a?.value_score ?? -999))

      // Fallback trigger: too few future picks to make the page feel alive.
      if (merged.length < MIN_FUTURE_PICKS) {
        const fallbackReason: 'all_picks_expired' | 'empty_cache' =
          leagueRows.some(r => Array.isArray(r.payload) && (r.payload as any[]).length > 0)
            ? 'all_picks_expired'
            : 'empty_cache'

        try {
          const quick = await quickFetchPredictions(8, 12)
          if (quick.length > 0) {
            // Write-through cache so the next request is instant.
            // Don't await persist — fire and forget keeps response time tight.
            persistQuickfetch(quick).catch(err =>
              console.error('[predictions] persist quickfetch threw:', err)
            )

            // Merge the fresh quickfetch picks with whatever future picks
            // we already had (dedupe by fixture id), then re-sort.
            const seen = new Set<number>()
            const combined: any[] = []
            for (const p of [...quick, ...merged]) {
              const id = p?.id
              if (id != null && seen.has(id)) continue
              if (id != null) seen.add(id)
              combined.push(p)
            }
            combined.sort((a: any, b: any) => (b?.value_score ?? -999) - (a?.value_score ?? -999))

            const meta = {
              leagues_count: leagueRows.length,
              league_names: leagueRows.map(r => r.league_name),
              fixture_count: combined.length,
              total_available: perLeagueArrays.reduce((s, a) => s + a.length, 0) + quick.length,
              oldest_refresh: leagueRows.reduce<string | null>((acc, r) => (!acc || r.generated_at < acc) ? r.generated_at : acc, null),
              newest_refresh: new Date().toISOString(),
              cache_generated_at: new Date().toISOString(),
              api_failures: leagueRows.reduce((s, r) => s + (r.api_failures ?? 0), 0),
              served_from_cache: false,
              source: 'predictions_by_league+quickfetch',
              fallback_used: true,
              fallback_reason: fallbackReason,
            }
            return NextResponse.json({ success: true, predictions: combined, meta })
          }
        } catch (qfErr) {
          console.error('[predictions] quickfetch fallback failed:', qfErr)
          // Fall through to "return whatever we have" path below.
        }

        // Quickfetch returned nothing OR threw. Return whatever picks DO
        // exist in cache (even already-kicked-off ones) rather than empty.
        const allPicksUnfiltered: any[][] = leagueRows.map(r => Array.isArray(r.payload) ? (r.payload as any[]) : [])
        const fallbackMerged = roundRobinPick(allPicksUnfiltered, 60)
        fallbackMerged.sort((a: any, b: any) => (b?.value_score ?? -999) - (a?.value_score ?? -999))

        const meta = {
          leagues_count: leagueRows.length,
          league_names: leagueRows.map(r => r.league_name),
          fixture_count: fallbackMerged.length,
          total_available: allPicksUnfiltered.reduce((s, a) => s + a.length, 0),
          oldest_refresh: leagueRows.reduce<string | null>((acc, r) => (!acc || r.generated_at < acc) ? r.generated_at : acc, null),
          newest_refresh: leagueRows.reduce<string | null>((acc, r) => (!acc || r.generated_at > acc) ? r.generated_at : acc, null),
          cache_generated_at: leagueRows.reduce<string | null>((acc, r) => (!acc || r.generated_at > acc) ? r.generated_at : acc, null),
          api_failures: leagueRows.reduce((s, r) => s + (r.api_failures ?? 0), 0),
          served_from_cache: true,
          source: 'predictions_by_league',
          fallback_used: true,
          fallback_reason: fallbackReason,
          warning: 'Picks may be stale — data feed temporarily unavailable',
        }
        return NextResponse.json({ success: true, predictions: fallbackMerged, meta })
      }

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
        fallback_used: false,
      }

      return NextResponse.json({ success: true, predictions: merged, meta })
    }

    // Empty per-league cache: try the legacy single-row table first.
    const { data, error } = await supabaseAdmin
      .from('predictions_cache')
      .select('payload, generated_at, fixture_count, leagues_count')
      .eq('id', 1)
      .single()

    if (!error && data) {
      const payload = data.payload as any
      const legacyPicks: any[] = Array.isArray(payload?.predictions) ? payload.predictions : []
      const futureLegacy = legacyPicks.filter(p => isFuturePick(p, nowMs))

      if (futureLegacy.length >= MIN_FUTURE_PICKS) {
        const enriched = {
          ...payload,
          predictions: futureLegacy,
          meta: {
            ...(payload.meta ?? {}),
            cache_generated_at: data.generated_at,
            fixture_count: futureLegacy.length,
            leagues_count: data.leagues_count,
            served_from_cache: true,
            source: 'predictions_cache_legacy',
            fallback_used: false,
          },
        }
        return NextResponse.json(enriched)
      }
      // Legacy cache exists but everything's expired — fall through to quickfetch.
    }

    // Last resort: nothing usable in either cache. Run quickfetch live.
    try {
      const quick = await quickFetchPredictions(8, 12)
      if (quick.length > 0) {
        persistQuickfetch(quick).catch(err =>
          console.error('[predictions] persist quickfetch threw:', err)
        )
        return NextResponse.json({
          success: true,
          predictions: quick,
          meta: {
            leagues_count: new Set(quick.map(p => p._leagueId)).size,
            fixture_count: quick.length,
            cache_generated_at: new Date().toISOString(),
            served_from_cache: false,
            source: 'quickfetch',
            fallback_used: true,
            fallback_reason: 'empty_cache',
          },
        })
      }
    } catch (qfErr) {
      console.error('[predictions] last-resort quickfetch failed:', qfErr)
    }

    // Truly nothing — but instead of 503, return whatever stale legacy
    // payload exists (if any) so the page never feels broken.
    if (!error && data) {
      const payload = data.payload as any
      return NextResponse.json({
        ...payload,
        meta: {
          ...(payload.meta ?? {}),
          cache_generated_at: data.generated_at,
          fixture_count: data.fixture_count,
          leagues_count: data.leagues_count,
          served_from_cache: true,
          source: 'predictions_cache_legacy',
          fallback_used: true,
          fallback_reason: 'all_picks_expired',
          warning: 'Picks may be stale — data feed temporarily unavailable',
        },
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Predictions are being generated. Please check back in a few minutes.',
        cache_miss: true,
      },
      { status: 503 }
    )
  } catch (err: any) {
    console.error('[predictions] DB read error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to load predictions' },
      { status: 500 }
    )
  }
}
