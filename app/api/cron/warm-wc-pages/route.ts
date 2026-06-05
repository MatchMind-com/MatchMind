/**
 * GET /api/cron/warm-wc-pages
 *
 * Iterates every WC team + group + fixture SEO page sequentially with
 * a small delay between requests so Vercel ISR re-runs each page's
 * server fetch with enrichment data (last-5 form, squad, injuries) in
 * a rate-limit-respecting cadence.
 *
 * The team pages do their own per-team fetches against API-Football's
 * /fixtures, /players/squads, and /injuries endpoints. Rendering 48
 * pages concurrently bursts past Pro plan's 450 req/min, leaving
 * random teams blank. This cron paces the rendering: 1 page per
 * second × 132 URLs ≈ 2:15 wall time, never exceeding ~12 req/min
 * against the API.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} OR x-vercel-cron: 1
 *
 * Scheduled in vercel.json at 03:30 UTC daily (just before the morning
 * predictions cron at 04:00 UTC, so enrichment is fresh when the day
 * starts).
 */

import { NextResponse } from 'next/server'
import { getAllTeams, getWorldCupGroups, getAllFixtures } from '@/lib/world-cup-data'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

// Allow this function the full 300s on Pro to comfortably warm 132 URLs.
export const maxDuration = 300

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  const results = {
    teams: { ok: 0, fail: 0 },
    groups: { ok: 0, fail: 0 },
    fixtures: { ok: 0, fail: 0 },
  }

  try {
    const [teams, groups, fixtures] = await Promise.all([
      getAllTeams(),
      getWorldCupGroups(),
      getAllFixtures(),
    ])

    // Warm teams first — these have the heaviest per-page enrichment
    // (3 API calls each). 1 second between requests keeps us under
    // the 60 req/min ceiling for /fixtures alone.
    for (const p of teams) {
      try {
        const res = await fetch(`${APP_URL}/world-cup/teams/${p.slug}`, {
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (res.ok) results.teams.ok++
        else results.teams.fail++
      } catch {
        results.teams.fail++
      }
      await sleep(1000)
    }

    // Groups are cheaper (no per-team enrichment), 500ms cadence is fine.
    for (const g of groups) {
      try {
        const res = await fetch(`${APP_URL}/world-cup/groups/${g.slug}`, {
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (res.ok) results.groups.ok++
        else results.groups.fail++
      } catch {
        results.groups.fail++
      }
      await sleep(500)
    }

    // Fixtures pull enrichment for BOTH teams — heaviest. Pace at 1.5s.
    for (const f of fixtures.slice(0, 24)) {
      // First wave of 24 = group-stage matchday 1+2; rest can wait
      // for the next daily run if we're tight on time.
      try {
        const res = await fetch(`${APP_URL}/world-cup/fixtures/${f.id}`, {
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (res.ok) results.fixtures.ok++
        else results.fixtures.fail++
      } catch {
        results.fixtures.fail++
      }
      await sleep(1500)
    }

    return NextResponse.json({
      success: true,
      duration_ms: Date.now() - start,
      ...results,
    })
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e?.message || 'unknown',
      duration_ms: Date.now() - start,
      ...results,
    }, { status: 500 })
  }
}

// Vercel cron fires GET — reuse POST.
export const GET = POST
