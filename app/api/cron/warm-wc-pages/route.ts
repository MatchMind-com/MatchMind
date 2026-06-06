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
import { revalidatePath } from 'next/cache'
import { getAllTeams, getTeamEnrichment, getAllFixtures } from '@/lib/world-cup-data'

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
  let revalidated = 0

  for (const profile of teams) {
    try {
      // 1) Populate Next.js fetch cache with team enrichment
      const enr = await getTeamEnrichment(profile.team.id)
      results.push({
        slug: profile.slug,
        form: enr.form.length,
        squad: enr.squad.length,
        injuries: enr.injuries.length,
      })

      // 2) Force the static page HTML to regenerate on next request —
      //    without this, pages serve their OLD static HTML and visitors
      //    never see the freshly-warmed data until ISR's 1h timer
      //    expires. revalidatePath invalidates the page cache so the
      //    next request rebuilds with the fresh fetch data.
      revalidatePath(`/world-cup/teams/${profile.slug}`)
      revalidated++
    } catch (e: any) {
      failures++
      results.push({ slug: profile.slug, form: 0, squad: 0, injuries: 0 })
    }
    await sleep(300)
  }

  // Also revalidate group + fixture pages so they pick up any team data
  // they embed (form pills on fixture pages, team links on group pages).
  try {
    const fixtures = await getAllFixtures()
    for (const f of fixtures) revalidatePath(`/world-cup/fixtures/${f.id}`)
    revalidatePath('/world-cup')
    revalidatePath('/dashboard/world-cup')
  } catch {}

  const populated = results.filter(r => r.squad > 0).length

  return NextResponse.json({
    success: true,
    duration_ms: Date.now() - start,
    teams_total: teams.length,
    teams_with_squad: populated,
    pages_revalidated: revalidated,
    teams_failed: failures,
    sample: results.slice(0, 5),
  })
}

export const GET = POST
