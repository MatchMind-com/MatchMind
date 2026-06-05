/**
 * /share/pick/[id]
 *
 * Per-pick share landing — used as TikTok bio link target, social
 * unfurls (Twitter / WhatsApp / iMessage), and any direct linkout from
 * other channels.
 *
 * Two roles:
 *   1. Generates rich OG metadata so the link unfurls into a beautiful
 *      preview card via /api/og/pick?id={id}
 *   2. Server-redirects to the pick's predictions page (or world-cup
 *      page for WC fixtures) so users land on the actual pick after
 *      the unfurl is captured.
 *
 * Fallback: if the fixture can't be found in the live cache, render a
 * minimal landing page with a CTA back to /world-cup.
 */

import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

interface Prediction {
  id: number
  home_team: string
  away_team: string
  league: string
  date?: string
  best_value?: { ev?: number; odds?: number; label?: string }
  recommended_bet?: string
  is_value_bet?: boolean
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

async function getPickById(id: number): Promise<Prediction | null> {
  try {
    const res = await fetch(`${APP_URL}/api/predictions`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    const data = await res.json()
    const preds = Array.isArray(data?.predictions) ? (data.predictions as Prediction[]) : []
    return preds.find(p => p.id === id) ?? null
  } catch {
    return null
  }
}

// IMPORTANT: must match the slug shape used by /predictions/[slug] —
// "kashima-vs-vissel-kobe-6-june-2026" (day-monthName-year), NOT
// "...-2026-06-06". Previously this used ISO date format and every
// share-link redirect 404'd because /predictions/[slug] couldn't match.
function slugify(str: string) {
  return str.toLowerCase()
    .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}
function makeSlug(home: string, away: string, iso?: string): string {
  if (!iso) return `${slugify(home)}-vs-${slugify(away)}`
  const date = new Date(iso)
  const day = date.getDate()
  const month = date.toLocaleString('en-US', { month: 'long' }).toLowerCase()
  const year = date.getFullYear()
  return `${slugify(home)}-vs-${slugify(away)}-${day}-${month}-${year}`
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const id = parseInt(params.id, 10)
  const pick = Number.isFinite(id) ? await getPickById(id) : null
  const ogImage = `${APP_URL}/api/og/pick?id=${id}`

  if (!pick) {
    return {
      title: 'AI Football Pick — MatchMind',
      description: 'AI value bets across 25 leagues. Every pick logged, every result public.',
      openGraph: {
        title: 'AI Football Pick — MatchMind',
        description: 'Find the edge.',
        images: [ogImage],
      },
      twitter: { card: 'summary_large_image', images: [ogImage] },
    }
  }

  const label = pick.best_value?.label ?? pick.recommended_bet ?? 'AI pick'
  const odds = pick.best_value?.odds
  const ev = pick.best_value?.ev
  const evStr = ev ? ` (+${ev}% EV)` : ''
  const oddsStr = odds ? ` @ ${odds.toFixed(2)}` : ''

  const title = `${pick.home_team} v ${pick.away_team} — ${label}${oddsStr} | MatchMind`
  const desc = `AI pick: ${label}${oddsStr}${evStr}. ${pick.league}. Every pick logged before kick-off, every result public.`

  return {
    title,
    description: desc,
    openGraph: { title, description: desc, images: [ogImage], type: 'website', url: `${APP_URL}/share/pick/${id}` },
    twitter: { card: 'summary_large_image', title, description: desc, images: [ogImage] },
  }
}

export default async function SharePickPage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  const pick = Number.isFinite(id) ? await getPickById(id) : null

  // If we have a real pick, server-redirect to the predictions detail
  // page once metadata has been served. Social-card crawlers (Facebook,
  // Twitter, Slack, WhatsApp) read the OG tags before navigation, so the
  // unfurl already worked by the time a real user hits the redirect.
  if (pick) {
    const slug = makeSlug(pick.home_team, pick.away_team, pick.date)
    redirect(`/predictions/${slug}`)
  }

  // Empty-state landing — pick wasn't in cache (settled, expired, or
  // never tracked). Link to /world-cup as the most likely intent.
  return (
    <main style={{ minHeight: '100vh', background: '#0F1115', color: '#F5F1E8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6B62', marginBottom: 16 }}>
          MatchMind
        </p>
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 16 }}>
          That pick has settled.
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.5, color: '#6E6B62', marginBottom: 32 }}>
          We log every pick before kick-off and every result publicly. Check today&apos;s value bets — or the full World Cup hub.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/world-cup"
            style={{
              background: '#F97316', color: '#fff', padding: '14px 28px', textDecoration: 'none',
              fontSize: 12, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}
          >
            World Cup hub →
          </Link>
          <Link
            href="/"
            style={{
              border: '1px solid #2A2F3A', color: '#6E6B62', padding: '14px 28px', textDecoration: 'none',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}
          >
            Today&apos;s picks
          </Link>
        </div>
      </div>
    </main>
  )
}
