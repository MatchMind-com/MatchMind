/**
 * Live-site smoke test — catches schema-mismatch and deploy-broken-page
 * bugs like the two we fixed on 2026-04-18.
 *
 * Run with: npm test
 * Override target with: SMOKE_BASE=https://preview.vercel.app npm test
 */
import { describe, it, expect } from 'vitest'

const BASE = process.env.SMOKE_BASE ?? 'https://www.matchmindcom.com'

const PUBLIC_PAGES = [
  '/',
  '/predictions',
  '/track-record',
  '/value-bets',
  '/login',
  '/signup',
]

const PUBLIC_APIS = [
  { path: '/api/predictions', shape: (j: any) => j.success === true },
  { path: '/api/stats/public', shape: (j: any) => typeof j.users === 'number' },
  { path: '/api/public/predictions', shape: (j: any) => j.success === true },
  { path: '/api/track-record', shape: (j: any) => j.stats && typeof j.stats.total === 'number' },
]

const CRON_PATHS = [
  '/api/cron/check-predictions',
  '/api/cron/daily-digest',
  '/api/cron/daily-value-bets',
  '/api/cron/onboarding-emails',
  '/api/cron/weekly-email',
  '/api/cron/check-bet-slips',
]

async function fetchWithTimeout(url: string, ms = 15_000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: 'follow' })
  } finally {
    clearTimeout(t)
  }
}

describe('public pages return 200', () => {
  for (const path of PUBLIC_PAGES) {
    it(path, async () => {
      const res = await fetchWithTimeout(BASE + path)
      expect(res.status).toBe(200)
    })
  }
})

describe('public APIs return 200 + valid shape', () => {
  for (const { path, shape } of PUBLIC_APIS) {
    it(path, async () => {
      const res = await fetchWithTimeout(BASE + path)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(shape(json), `shape check failed for ${path}: ${JSON.stringify(json).slice(0, 200)}`).toBe(true)
    })
  }
})

describe('cron endpoints require auth', () => {
  for (const path of CRON_PATHS) {
    it(path, async () => {
      const res = await fetchWithTimeout(BASE + path)
      // Should be 401 (unauthorized) — definitely NOT 200 (would mean unprotected) or 500 (would mean code error)
      expect([401, 403, 405], `${path} returned ${res.status} — expected 401/403/405`).toContain(res.status)
    })
  }
})

describe('match detail page renders (covers the 2026-04-18 schema bug)', () => {
  it('fetches first prediction and hits its slug page', async () => {
    const listRes = await fetchWithTimeout(BASE + '/api/predictions')
    const list = await listRes.json()
    expect(list.success).toBe(true)
    const first = list.predictions?.[0]
    expect(first, 'expected at least one prediction from /api/predictions').toBeTruthy()

    // Build the same slug that /predictions/page.tsx uses
    const slugify = (s: string) => s.toLowerCase()
      .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n')
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
    const d = new Date(first.date)
    const slug = `${slugify(first.home_team)}-vs-${slugify(first.away_team)}-${d.getDate()}-${d.toLocaleString('en-US', { month: 'long' }).toLowerCase()}-${d.getFullYear()}`

    const apiRes = await fetchWithTimeout(`${BASE}/api/public/match-prediction?slug=${slug}`)
    expect([200, 404], `match-prediction API returned ${apiRes.status} for ${slug}`).toContain(apiRes.status)
  }, 30_000)
})
