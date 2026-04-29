'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

/* ─── Nav icons — thin, editorial line set ─── */
function IconHome() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-7h6v7h3a1 1 0 001-1V10" />
    </svg>
  )
}
function IconPicks() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}
function IconCoach() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a7 7 0 00-4 12.7V18a2 2 0 002 2h4a2 2 0 002-2v-2.3A7 7 0 0012 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 22h6" />
    </svg>
  )
}
function IconMoney() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v10M9 9.5a2 2 0 012-1.5h2a2 2 0 010 4h-2a2 2 0 000 4h2a2 2 0 002-1.5" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}
function IconSettings() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function IconSignOut() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}
function IconMenu() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}
function IconClose() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

/* ─── Nav structure — 5 primary items, editorial single list ───
   Old routes still resolve via direct URL; they're just demoted from the nav. */
const NAV: Array<{
  href: string
  label: string
  icon: React.ReactNode
  exact?: boolean
  matches?: string[]
}> = [
  { href: '/dashboard', label: 'Home', icon: <IconHome />, exact: true },
  {
    // Phase 3: new editorial Picks page (Today / Tomorrow / Weekend / Live / Accumulators).
    // Old /dashboard/predictions and /dashboard/live still resolve so any external links keep working.
    href: '/dashboard/picks',
    label: 'Picks',
    icon: <IconPicks />,
    matches: ['/dashboard/picks', '/dashboard/predictions', '/dashboard/live'],
  },
  { href: '/dashboard/coach', label: 'Coach', icon: <IconCoach /> },
  {
    // Phase 5 will build /dashboard/money; until then, send users to bankroll.
    href: '/dashboard/bankroll',
    label: 'Money',
    icon: <IconMoney />,
    matches: ['/dashboard/money', '/dashboard/bankroll', '/dashboard/track-record', '/dashboard/dream-bet'],
  },
  { href: '/dashboard/settings', label: 'Settings', icon: <IconSettings /> },
]

function NavItem({
  item,
  pathname,
  onClick,
}: {
  item: { href: string; label: string; icon: React.ReactNode; exact?: boolean; matches?: string[] }
  pathname: string
  onClick: () => void
}) {
  const active = item.exact
    ? pathname === item.href
    : (item.matches ?? [item.href]).some((p) => pathname === p || pathname.startsWith(p + '/') || pathname === p)
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`
        group relative flex items-center gap-3.5 pl-5 pr-4 py-2.5 text-[14px]
        transition-all duration-150
        ${active
          ? 'text-fg font-semibold'
          : 'text-fg-muted hover:text-fg-secondary font-medium'
        }
      `}
    >
      {/* Editorial active marker — left-edge orange bar (no fill background) */}
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all
          ${active ? 'h-7 bg-brand' : 'h-0 bg-transparent group-hover:h-3 group-hover:bg-fg-muted/40'}
        `}
        aria-hidden
      />
      <span className={`transition-colors ${active ? 'text-brand' : 'text-fg-muted/70 group-hover:text-fg-secondary'}`}>
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Link>
  )
}

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const username = email.split('@')[0]

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const sidebarContent = (
    <aside className="w-60 bg-bg-base border-r border-border-subtle h-full flex flex-col">

      {/* Logo — refined, editorial */}
      <div className="px-5 pt-6 pb-5">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/25 flex items-center justify-center flex-shrink-0">
            <Image src="/logo-icon.png" alt="MatchMind" width={18} height={18} className="object-contain" />
          </div>
          <div className="leading-none">
            <div className="text-fg font-black text-[17px] tracking-tightest">
              Match<span className="text-brand">Mind</span>
            </div>
            <div className="text-fg-muted text-[9px] uppercase tracking-[0.18em] mt-1 font-semibold">
              Football Intelligence
            </div>
          </div>
        </Link>
      </div>

      {/* Section divider */}
      <div className="mx-5 h-px bg-border-subtle" />

      {/* Nav — single clean list, no section labels */}
      <nav className="flex-1 overflow-y-auto py-5">
        <div className="space-y-0.5">
          {NAV.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              pathname={pathname}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </div>
      </nav>

      {/* User footer — its own visual treatment */}
      <div className="border-t border-border-subtle p-4">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-9 h-9 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center flex-shrink-0">
            <span className="text-brand text-[13px] font-black uppercase">{username.charAt(0)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-fg text-[13px] font-semibold truncate leading-tight">{username}</p>
            <p className="text-fg-muted text-[11px] truncate leading-tight mt-0.5">{email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold
                     text-fg-muted hover:text-fg hover:bg-bg-surface border border-transparent hover:border-border-subtle
                     transition-all"
        >
          <IconSignOut />
          Sign out
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-bg-base/95 backdrop-blur-xl border-b border-border-subtle flex items-center justify-between px-4 h-14">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/25 flex items-center justify-center">
            <Image src="/logo-icon.png" alt="MatchMind" width={16} height={16} className="object-contain" />
          </div>
          <div className="text-fg font-black text-[15px] tracking-tightest">
            Match<span className="text-brand">Mind</span>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-fg-secondary hover:text-fg p-1 transition-colors"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <IconClose /> : <IconMenu />}
        </button>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 z-30">
        {sidebarContent}
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="lg:hidden fixed left-0 top-0 bottom-0 z-50">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  )
}
