/**
 * /world-cup/groups/[group]
 *
 * Programmatic SEO page — one per WC group (A through L, 12 pages).
 *
 * Target queries:
 *   "Group A World Cup 2026 predictions"
 *   "Group F World Cup 2026 fixtures"
 *   "Brazil group World Cup 2026"
 *   "[group] standings predictions"
 *
 * Each page lists the 4 teams + all 6 group-stage fixtures, with deep
 * links to per-team pages and to the public /share/pick/[id] preview
 * for any fixture that has an AI value bet.
 *
 * Generated statically at build via generateStaticParams — fast first
 * paint, Google-friendly, and the underlying data is revalidated hourly.
 */

import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  getWorldCupGroups,
  getGroupBySlug,
  teamSlug,
  type WCFixture,
} from '@/lib/world-cup-data'
import TrackRecordBadge from '@/components/world-cup/TrackRecordBadge'

export const revalidate = 3600

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

export async function generateStaticParams() {
  const groups = await getWorldCupGroups()
  return groups.map(g => ({ group: g.slug }))
}

export async function generateMetadata(
  { params }: { params: { group: string } },
): Promise<Metadata> {
  const group = await getGroupBySlug(params.group)
  if (!group) {
    return {
      title: 'World Cup 2026 Group — MatchMind',
      description: 'AI predictions for the 2026 World Cup.',
    }
  }
  const teamList = group.teams.map(t => t.name).join(', ')
  const title = `${group.name} — World Cup 2026 Predictions & Fixtures | MatchMind`
  const description = `AI value-bet predictions for ${group.name} at the 2026 World Cup: ${teamList}. Every pick logged before kick-off, every result tracked publicly.`
  // Per-group custom OG card — 2×2 team grid with flags.
  const ogImage = `${APP_URL}/api/og/wc-group?slug=${group.slug}`

  return {
    title,
    description,
    alternates: { canonical: `${APP_URL}/world-cup/groups/${group.slug}` },
    openGraph: {
      title,
      description,
      images: [ogImage],
      type: 'website',
      url: `${APP_URL}/world-cup/groups/${group.slug}`,
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

function fmtKickoff(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/London',
    }) + ' BST'
  } catch {
    return ''
  }
}

function FixtureRow({ f }: { f: WCFixture }) {
  return (
    <li className="border-b border-border-subtle py-3.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {f.home.logo && (
          <Image src={f.home.logo} alt="" width={20} height={20} className="shrink-0" unoptimized />
        )}
        <Link
          href={`/world-cup/teams/${teamSlug(f.home.name)}`}
          className="text-fg hover:text-brand transition-colors font-semibold truncate"
        >
          {f.home.name}
        </Link>
        <span className="text-fg-muted text-xs px-1">v</span>
        <Link
          href={`/world-cup/teams/${teamSlug(f.away.name)}`}
          className="text-fg hover:text-brand transition-colors font-semibold truncate"
        >
          {f.away.name}
        </Link>
        {f.away.logo && (
          <Image src={f.away.logo} alt="" width={20} height={20} className="shrink-0" unoptimized />
        )}
      </div>
      <div className="font-mono text-fg-muted text-xs whitespace-nowrap">
        {fmtKickoff(f.date)}
      </div>
    </li>
  )
}

export default async function GroupPage({ params }: { params: { group: string } }) {
  const group = await getGroupBySlug(params.group)
  if (!group) notFound()

  const teamList = group.teams.map(t => t.name).join(', ')

  return (
    <main className="min-h-screen bg-bg-base text-fg">
      <div className="max-w-5xl mx-auto px-5 lg:px-8 pt-10 lg:pt-16 pb-20">

        {/* Breadcrumb */}
        <nav className="text-fg-muted text-xs mb-6 flex gap-2 items-center">
          <Link href="/" className="hover:text-brand transition-colors">MatchMind</Link>
          <span>·</span>
          <Link href="/world-cup" className="hover:text-brand transition-colors">World Cup 2026</Link>
          <span>·</span>
          <span className="text-fg-secondary">{group.name}</span>
        </nav>

        {/* Eyebrow + headline */}
        <p className="eyebrow text-brand mb-3">FIFA World Cup 2026</p>
        <h1 className="font-display text-5xl md:text-6xl font-black tracking-tight leading-[1.05] mb-5">
          {group.name}
        </h1>
        <p className="text-fg-secondary text-lg max-w-2xl mb-6 leading-relaxed">
          {teamList}. AI value-bet predictions are released each morning during the group stage —
          every pick logged before kick-off, every result published.
        </p>

        <TrackRecordBadge />

        {/* Teams grid */}
        <section className="mb-12">
          <p className="eyebrow mb-4">Teams</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {group.teams.map(t => (
              <Link
                key={t.id}
                href={`/world-cup/teams/${teamSlug(t.name)}`}
                className="card hover:border-border-strong transition-colors flex items-center gap-3 group"
              >
                {t.logo && (
                  <Image src={t.logo} alt="" width={28} height={28} className="shrink-0" unoptimized />
                )}
                <span className="font-semibold truncate group-hover:text-brand transition-colors">
                  {t.name}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Fixtures list */}
        <section className="mb-12">
          <p className="eyebrow mb-4">Group-stage fixtures ({group.fixtures.length})</p>
          {group.fixtures.length === 0 ? (
            <p className="text-fg-muted text-sm">Fixtures will appear here once the draw data syncs.</p>
          ) : (
            <ul className="border-t border-border-subtle">
              {group.fixtures.map(f => <FixtureRow key={f.id} f={f} />)}
            </ul>
          )}
        </section>

        {/* CTA — email capture redirect to /world-cup#email-capture */}
        <section className="border border-border-subtle p-6 md:p-8 bg-bg-surface">
          <h2 className="font-display text-2xl md:text-3xl font-black tracking-tight mb-3">
            Free {group.name} predictions every morning
          </h2>
          <p className="text-fg-secondary mb-5 max-w-2xl">
            We email every value bet our AI finds for {group.name}, ranked by edge. No card needed,
            no spam — drop your email and you&apos;re on the list.
          </p>
          <Link
            href="/world-cup#email-capture"
            className="inline-block bg-brand hover:bg-brand-hover text-bg-base font-black text-xs uppercase tracking-[0.1em] px-7 py-4 transition-colors"
          >
            Get free WC picks →
          </Link>
        </section>

        {/* Internal links — other groups */}
        <section className="mt-12 pt-8 border-t border-border-subtle">
          <p className="eyebrow mb-4">All groups</p>
          <div className="flex flex-wrap gap-2">
            {(await getWorldCupGroups()).map(g => (
              <Link
                key={g.slug}
                href={`/world-cup/groups/${g.slug}`}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                  g.slug === group.slug
                    ? 'bg-brand/15 text-brand border border-brand/30'
                    : 'border border-border-subtle text-fg-muted hover:text-brand hover:border-brand/30'
                }`}
              >
                {g.name}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
