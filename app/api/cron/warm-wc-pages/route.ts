/**
 * GET /api/cron/warm-wc-pages
 *
 * Pre-fetches the Next.js fetch cache for every WC team's enrichment
 * data (last-5 form, squad, injuries) by calling getTeamEnrichment
 * directly — NOT by rendering the page URL.
 *
 * Why: rendering pages via fetch() triggers ISR's stale-while-
 * revalidate, which returns cached HTML immediately and revalidates
 * in the background. The cron then "completes" but the cache might
 * not actually be repopulated by the time we check. Calling the data
 * fetcher directly synchronously populates Next.js's per-fetch cache
 * via the revalidate option.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} OR x-vercel-cron: 1
 * Scheduled in vercel.json at 03:30 UTC daily.
 */

import { NextResponse } from 'next/server'
import { getAllTeams, getTeamEnrichment } from '@/lib/world-cup-data'

// Pro tier maxDuration. Sequential warmup of 48 teams × 3 calls each
// at ~300ms per call ≈ 45 seconds. Plenty of headroom.
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
  const teams = await getAllTeams()
  const results: Array<{ slug: string; form: number; squad: number; injuries: number }> = []
  let failures = 0

  for (const profile of teams) {
    try {
      const enr = await getTeamEnrichment(profile.team.id)
      results.push({
        slug: profile.slug,
        form: enr.form.length,
        squad: enr.squad.length,
        injuries: enr.injuries.length,
      })
    } catch (e: any) {
      failures++
      results.push({ slug: profile.slug, form: 0, squad: 0, injuries: 0 })
    }
    // Small breather between teams so we never approach the 7.5 req/sec
    // sustained limit. Total wall time ≈ 48 × 0.6s = ~30s + actual fetch
    // latency = ~45s. Well under our 300s function budget.
    await sleep(300)
  }

  const populated = results.filter(r => r.squad > 0).length

  return NextResponse.json({
    success: true,
    duration_ms: Date.now() - start,
    teams_total: teams.length,
    teams_with_squad: populated,
    teams_failed: failures,
    sample: results.slice(0, 5),
  })
}

export const GET = POST
