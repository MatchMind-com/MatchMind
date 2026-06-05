/**
 * /dashboard/world-cup
 *
 * In-app World Cup hub for logged-in users — same data as the public
 * /world-cup landing page, but rendered inside the dashboard layout
 * (sidebar + live-match bar + auth-gated).
 *
 * Public /world-cup remains for unauthenticated TikTok / share-link
 * visitors; the sidebar "World Cup" item points here so logged-in
 * users get the dashboard chrome.
 */

import Link from 'next/link'
import Image from 'next/image'
import { getWorldCupGroups, teamSlug, type WCFixture } from '@/lib/world-cup-data'

export const revalidate = 3600

const WC_KICKOFF_ISO = '2026-06-11T19:00:00+00:00'

/** Pick the next ~6 fixtures kicking off within the next 36h. */
function nextFixtures(allFixtures: WCFixture[], hours = 36, max = 6): WCFixture[] {
  const now = Date.now()
  const cutoff = now + hours * 3600 * 1000
  return allFixtures
    .filter(f => {
      const t = new Date(f.date).getTime()
      return Number.isFinite(t) && t > now && t < cutoff
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, max)
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
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
    <li className="flex items-center justify-between gap-3 py-2 border-b border-border-subtle last:border-0">
      <div className="flex items-center gap-2 min-w-0 flex-1 text-sm">
        {f.home.logo && <Image src={f.home.logo} alt="" width={16} height={16} className="shrink-0" unoptimized />}
        <Link
          href={`/world-cup/teams/${teamSlug(f.home.name)}`}
          className="font-semibold truncate hover:text-brand transition-colors"
        >
          {f.home.name}
        </Link>
        <span className="text-fg-muted text-xs px-1">v</span>
        <Link
          href={`/world-cup/teams/${teamSlug(f.away.name)}`}
          className="font-semibold truncate hover:text-brand transition-colors"
        >
          {f.away.name}
        </Link>
        {f.away.logo && <Image src={f.away.logo} alt="" width={16} height={16} className="shrink-0" unoptimized />}
      </div>
      <span className="font-mono text-fg-muted text-[11px] whitespace-nowrap">
        {fmtKickoff(f.date).replace(' BST', '')}
      </span>
    </li>
  )
}

export default async function DashboardWorldCupPage() {
  const groups = await getWorldCupGroups()
  const days = daysUntil(WC_KICKOFF_ISO)
  // Flatten all group-stage fixtures, then surface the next handful
  const allFixtures = groups.flatMap(g => g.fixtures)
    .filter((f, i, arr) => arr.findIndex(x => x.id === f.id) === i)
  const upNext = nextFixtures(allFixtures, 36, 6)

  return (
    <div className="p-5 lg:p-7 max-w-6xl mx-auto space-y-6">

      {/* Header — matches dashboard style (compact, eyebrow + h1) */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow text-brand mb-1">FIFA World Cup 2026</p>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight leading-none">
            World Cup hub
          </h1>
          <p className="text-fg-muted text-sm mt-2">
            48 teams · 12 groups · {groups.reduce((acc, g) => acc + g.fixtures.length, 0)} group-stage matches.
            AI predictions release each morning during the tournament.
          </p>
        </div>
        {days > 0 && (
          <div className="text-right">
            <p className="font-stat text-5xl font-black text-brand leading-none">{days}</p>
            <p className="text-fg-muted text-[10px] font-bold uppercase tracking-widest mt-1">
              days until kickoff
            </p>
          </div>
        )}
      </header>

      {/* Up next — surfaces during/just before WC. Hides if no
          fixtures inside the 36h window (off-tournament periods). */}
      {upNext.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="eyebrow">Up next · 36h</p>
            <p className="text-fg-muted text-[10px] font-bold uppercase tracking-widest">
              {upNext.length} match{upNext.length === 1 ? '' : 'es'}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {upNext.map(f => {
              const ko = new Date(f.date).toLocaleString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit',
                timeZone: 'Europe/London',
              })
              return (
                <Link
                  key={f.id}
                  href={`/world-cup/fixtures/${f.id}`}
                  className="card hover:border-border-strong transition-colors group block"
                >
                  <p className="eyebrow text-brand mb-2">{f.round}</p>
                  <div className="flex items-center gap-3 mb-2 min-w-0">
                    {f.home.logo && <Image src={f.home.logo} alt="" width={20} height={20} className="shrink-0" unoptimized />}
                    <span className="font-semibold text-sm truncate group-hover:text-brand transition-colors">{f.home.name}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-3 min-w-0">
                    {f.away.logo && <Image src={f.away.logo} alt="" width={20} height={20} className="shrink-0" unoptimized />}
                    <span className="font-semibold text-sm truncate group-hover:text-brand transition-colors">{f.away.name}</span>
                  </div>
                  <p className="font-mono text-fg-muted text-[11px]">{ko} BST</p>
                  {f.venue.name && (
                    <p className="text-fg-muted text-[11px] mt-0.5 truncate">{f.venue.name}</p>
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Quick promo banner — wallet-style, sits inside the layout */}
      <section className="card bg-brand/5 border-brand/20">
        <div className="flex items-start gap-3">
          <span className="text-brand text-2xl leading-none">⚡</span>
          <div>
            <p className="font-semibold text-fg">All picks unlocked free during the group stage</p>
            <p className="text-fg-muted text-sm mt-1">
              Through July 3rd, every WC pick our AI generates is available without the free-tier cap.
            </p>
          </div>
        </div>
      </section>

      {/* Groups grid */}
      {groups.length === 0 ? (
        <section className="card">
          <p className="text-fg-muted text-sm">Group data is syncing — refresh in a moment.</p>
        </section>
      ) : (
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="eyebrow">Groups</p>
            <Link
              href="/world-cup"
              className="text-fg-muted hover:text-brand text-[11px] font-bold uppercase tracking-widest transition-colors"
            >
              Public hub →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(g => (
              <article
                key={g.slug}
                className="card hover:border-border-strong transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <Link
                    href={`/world-cup/groups/${g.slug}`}
                    className="font-display text-xl font-black tracking-tight hover:text-brand transition-colors"
                  >
                    {g.name}
                  </Link>
                  <span className="text-fg-muted text-[10px] font-bold uppercase tracking-widest">
                    {g.fixtures.length} matches
                  </span>
                </div>

                {/* Teams */}
                <ul className="space-y-1.5 mb-4">
                  {g.teams.map(t => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      {t.logo && <Image src={t.logo} alt="" width={18} height={18} className="shrink-0" unoptimized />}
                      <Link
                        href={`/world-cup/teams/${teamSlug(t.name)}`}
                        className="text-fg hover:text-brand transition-colors font-medium truncate"
                      >
                        {t.name}
                      </Link>
                    </li>
                  ))}
                </ul>

                {/* First match preview */}
                {g.fixtures.length > 0 && (
                  <>
                    <p className="eyebrow mb-2">First match</p>
                    <ul className="border-t border-border-subtle">
                      <FixtureRow f={g.fixtures[0]} />
                    </ul>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Footnote */}
      <p className="text-fg-muted text-xs text-center pt-4">
        Every WC pick is logged before kick-off · results auto-verified · 18+ ·{' '}
        <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">
          BeGambleAware.org
        </a>
      </p>
    </div>
  )
}
