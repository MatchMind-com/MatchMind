import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getWorldCupGroups, getAllTeams } from '@/lib/world-cup-data'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function slugify(str: string) {
  return str.toLowerCase()
    .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

function makeSlug(home: string, away: string, kickOff: string) {
  const date = new Date(kickOff)
  const day = date.getDate()
  const month = date.toLocaleString('en-US', { month: 'long' }).toLowerCase()
  const year = date.getFullYear()
  return `${slugify(home)}-vs-${slugify(away)}-${day}-${month}-${year}`
}

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`,             changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/world-cup`,    changeFrequency: 'daily',   priority: 0.95 },
    { url: `${BASE}/predictions`,  changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${BASE}/track-record`, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE}/value-bets`,   changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${BASE}/signup`,       changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/login`,        changeFrequency: 'monthly', priority: 0.4 },
  ]

  // World Cup programmatic pages — 12 groups + 48 teams = 60 high-value
  // SEO landings for queries like "Brazil World Cup 2026 predictions" and
  // "Group F World Cup 2026 fixtures". Fail-soft: if API-Football is down,
  // we keep the static + match pages and skip WC.
  const wcPages: MetadataRoute.Sitemap = []
  try {
    const [groups, teams] = await Promise.all([getWorldCupGroups(), getAllTeams()])
    for (const g of groups) {
      wcPages.push({
        url: `${BASE}/world-cup/groups/${g.slug}`,
        changeFrequency: 'daily',
        priority: 0.85,
      })
    }
    for (const p of teams) {
      wcPages.push({
        url: `${BASE}/world-cup/teams/${p.slug}`,
        changeFrequency: 'daily',
        priority: 0.85,
      })
    }
  } catch (e) {
    console.error('[sitemap] WC pages skipped:', (e as Error).message)
  }

  try {
    // Include every match prediction within ±7 days — each is a unique landing
    // page with real keyword value ("Team A vs Team B prediction DATE").
    const from = new Date()
    from.setDate(from.getDate() - 7)
    const to = new Date()
    to.setDate(to.getDate() + 7)

    const { data } = await supabase
      .from('prediction_records')
      .select('home_team, away_team, kick_off')
      .gte('kick_off', from.toISOString())
      .lte('kick_off', to.toISOString())
      .lte('ev_percent', 10)
      .lte('odds', 4.0)

    const seen = new Set<string>()
    const matchPages: MetadataRoute.Sitemap = []
    for (const r of data ?? []) {
      const slug = makeSlug(r.home_team, r.away_team, r.kick_off)
      if (seen.has(slug)) continue
      seen.add(slug)
      const isPast = new Date(r.kick_off) < new Date()
      matchPages.push({
        url: `${BASE}/predictions/${slug}`,
        lastModified: new Date(r.kick_off),
        changeFrequency: isPast ? 'monthly' : 'hourly',
        priority: isPast ? 0.5 : 0.8,
      })
    }

    return [...staticPages, ...wcPages, ...matchPages]
  } catch (e) {
    console.error('[sitemap] fell back to static + WC pages:', (e as Error).message)
    return [...staticPages, ...wcPages]
  }
}
