/**
 * /admin/ig-preview
 *
 * Visual gallery of every IG-format OG card. Auth-gated via the admin
 * layout. Use to preview daily/evergreen/per-fixture variants before
 * posting to Instagram.
 *
 * Each tile:
 *   - 4:5 thumbnail
 *   - Endpoint URL (click to open full-size, right-click → Save Image As)
 *   - Variant picker (group, fixture, etc.) where relevant
 *
 * Cache-busts the image src on every render so you always see the
 * latest data, not a stale cached preview.
 */

import Link from 'next/link'
import { getWorldCupGroups, getAllFixtures, type WCGroup, type WCFixture } from '@/lib/world-cup-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'

interface CardSpec {
  key: string
  name: string
  endpoint: string
  desc: string
  category: 'daily' | 'weekly' | 'evergreen' | 'per-fixture' | 'per-group'
  schedule?: string
}

const CORE_CARDS: CardSpec[] = [
  {
    key: 'value-card',
    name: "Today's #1 value bet",
    endpoint: '/api/og/ig-value-card',
    desc: "Auto-picks today's highest-EV bet. Posts Tue-Sat by cron.",
    category: 'daily',
    schedule: 'Tue–Sat 17:30 UTC',
  },
  {
    key: 'recap',
    name: "Yesterday's W/L recap",
    endpoint: '/api/og/ig-recap',
    desc: "Honest day: W, L, net P&L. 'Losses go up too.' Posts Mon by cron.",
    category: 'daily',
    schedule: 'Mon 17:30 UTC',
  },
  {
    key: 'team-stats',
    name: 'Most predictable teams',
    endpoint: '/api/og/ig-team-stats',
    desc: 'Top 6 teams by AI hit rate. Saveable. Posts Sun by cron.',
    category: 'weekly',
    schedule: 'Sun 17:30 UTC',
  },
  {
    key: 'why-publish-losses',
    name: 'Why we publish every loss',
    endpoint: '/api/og/ig-why-publish-losses',
    desc: 'Evergreen trust card. Post once a week as variety.',
    category: 'evergreen',
  },
  {
    key: 'value-bet-math',
    name: 'Value-bet maths in 30s',
    endpoint: '/api/og/ig-value-bet-math',
    desc: 'Evergreen 3-step explainer. High save rate.',
    category: 'evergreen',
  },
  {
    key: 'coach-positioning',
    name: 'You\'re the coach',
    endpoint: '/api/og/ig-coach-positioning',
    desc: 'Evergreen brand statement + 4 tools.',
    category: 'evergreen',
  },
]

export default async function IGPreviewPage() {
  // Fetch WC data once for both the bracket carousel and the fixture deep-dive
  const [groups, fixtures] = await Promise.all([
    getWorldCupGroups().catch(() => [] as WCGroup[]),
    getAllFixtures().catch(() => [] as WCFixture[]),
  ])
  // Cache-bust query so previews always re-render with latest data
  const bust = Date.now()

  // Pick the next few upcoming fixtures for the deep-dive picker
  const upcomingFixtures = fixtures
    .filter(f => new Date(f.date).getTime() > Date.now())
    .slice(0, 8)

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">IG card preview gallery</h1>
        <p className="text-sm text-neutral-400 mt-2 max-w-2xl">
          Every 1080×1350 card available for Instagram. Right-click any thumbnail → <em>Save Image As</em> to download.
          Click to open the live URL in a new tab.
        </p>
      </header>

      {/* ── CORE CARDS ── */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-4">Daily / weekly / evergreen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CORE_CARDS.map(card => {
            const url = `${APP_URL}${card.endpoint}?_=${bust}`
            const liveUrl = `${APP_URL}${card.endpoint}`
            return (
              <article key={card.key} className="bg-neutral-900 border border-neutral-800 overflow-hidden">
                <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={card.name}
                    width={1080}
                    height={1350}
                    className="w-full h-auto block hover:opacity-90 transition-opacity"
                    style={{ aspectRatio: '1080 / 1350' }}
                  />
                </a>
                <div className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm">{card.name}</h3>
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
                      {card.category}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 leading-snug">{card.desc}</p>
                  {card.schedule && (
                    <p className="text-[11px] text-orange-400 font-mono mt-1">{card.schedule}</p>
                  )}
                  <p className="text-[10px] text-neutral-500 font-mono mt-2 truncate">{card.endpoint}</p>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* ── BRACKET CAROUSEL ── */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-1">WC bracket carousel</h2>
        <p className="text-xs text-neutral-400 mb-4">
          12 slides — post as a single IG carousel. One per group.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {groups.length === 0 ? (
            <p className="text-sm text-neutral-500 col-span-full">
              No group data — API-Football WC standings empty.
            </p>
          ) : (
            groups.map(g => {
              const endpoint = `/api/og/ig-bracket?group=${g.slug}`
              const url = `${APP_URL}${endpoint}&_=${bust}`
              const liveUrl = `${APP_URL}${endpoint}`
              return (
                <article key={g.slug} className="bg-neutral-900 border border-neutral-800 overflow-hidden">
                  <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={g.name}
                      width={1080}
                      height={1350}
                      className="w-full h-auto block hover:opacity-90 transition-opacity"
                      style={{ aspectRatio: '1080 / 1350' }}
                    />
                  </a>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold">{g.name}</p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">{g.teams.length} teams</p>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </section>

      {/* ── FIXTURE DEEP-DIVE PICKER ── */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-1">Match-preview deep-dive</h2>
        <p className="text-xs text-neutral-400 mb-4">
          Statengine-style with both teams&apos; last-5 form, venue, kick-off. Best for Fri/Sun pre-match posts.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {upcomingFixtures.length === 0 ? (
            <p className="text-sm text-neutral-500 col-span-full">
              No upcoming fixtures.
            </p>
          ) : (
            upcomingFixtures.map(f => {
              const endpoint = `/api/og/ig-fixture-deepdive?id=${f.id}`
              const url = `${APP_URL}${endpoint}&_=${bust}`
              const liveUrl = `${APP_URL}${endpoint}`
              const kickoff = new Date(f.date).toLocaleString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
              })
              return (
                <article key={f.id} className="bg-neutral-900 border border-neutral-800 overflow-hidden">
                  <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`${f.home.name} v ${f.away.name}`}
                      width={1080}
                      height={1350}
                      className="w-full h-auto block hover:opacity-90 transition-opacity"
                      style={{ aspectRatio: '1080 / 1350' }}
                    />
                  </a>
                  <div className="p-4">
                    <p className="font-semibold text-sm">{f.home.name} v {f.away.name}</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5 font-mono">{kickoff} BST</p>
                    {f.venue.name && (
                      <p className="text-[10px] text-neutral-500 mt-0.5 truncate">{f.venue.name}</p>
                    )}
                  </div>
                </article>
              )
            })
          )}
        </div>
      </section>

      {/* ── USAGE NOTES ── */}
      <section className="mt-12 border-t border-neutral-800 pt-8">
        <h2 className="text-lg font-semibold tracking-tight mb-3">How to post</h2>
        <ol className="text-sm text-neutral-300 space-y-2 list-decimal list-inside max-w-2xl">
          <li>Right-click any thumbnail → <em>Save Image As</em> (or open the URL in a new tab and screenshot at 1080×1350).</li>
          <li>Upload to Instagram via the app or the web composer.</li>
          <li>For the bracket: select all 12 group images in order (A → L), upload as a single carousel post.</li>
          <li>Caption template lives in <code>docs/instagram-growth-plan.md</code>.</li>
        </ol>
        <p className="text-xs text-neutral-500 mt-6">
          <code>post-instagram</code> cron auto-posts the rotating daily card (value-card / recap / team-stats by day-of-week) at 17:30 UTC. The other cards in this gallery are for manual variety.
        </p>
      </section>
    </div>
  )
}
