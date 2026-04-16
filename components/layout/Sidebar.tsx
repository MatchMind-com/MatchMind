'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

/* ───── NAV DATA ───── */
type NavItem = { href: string; label: string; exact: boolean }

type Section = {
  key: string
  label: string
  icon: (open: boolean, hasActive: boolean) => React.ReactNode
  items: NavItem[]
}

const SECTIONS: Section[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: (open, active) => (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    items: [
      { href: '/dashboard', label: 'Dashboard', exact: true },
      { href: '/dashboard/statistics', label: 'Statistics', exact: false },
      { href: '/dashboard/bankroll', label: 'Bankroll', exact: false },
    ],
  },
  {
    key: 'ai',
    label: 'AI Tools',
    icon: (open, active) => (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    items: [
      { href: '/dashboard/predictions', label: 'AI Predictions', exact: false },
      { href: '/dashboard/coach', label: 'Football Coach', exact: false },
    ],
  },
  {
    key: 'account',
    label: 'Account',
    icon: (open, active) => (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    items: [
      { href: '/dashboard/billing', label: 'Billing', exact: false },
      { href: '/dashboard/settings', label: 'Settings', exact: false },
    ],
  },
]

/* ───── HELPERS ───── */
function isItemActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href)
}

function sectionHasActive(section: Section, pathname: string) {
  return section.items.some((i) => isItemActive(i, pathname))
}

/* ───── COLLAPSIBLE SECTION ───── */
function SidebarSection({
  section,
  pathname,
  onNavigate,
}: {
  section: Section
  pathname: string
  onNavigate: () => void
}) {
  const hasActive = sectionHasActive(section, pathname)
  const [open, setOpen] = useState(hasActive)

  // auto-open section when user navigates into it
  useEffect(() => {
    if (hasActive) setOpen(true)
  }, [hasActive])

  return (
    <div>
      {/* Section header — click to toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all
          ${hasActive
            ? 'text-white'
            : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
          }`}
      >
        <span className="flex items-center gap-3">
          <span className={hasActive ? 'text-violet-400' : 'text-white/25'}>
            {section.icon(open, hasActive)}
          </span>
          {section.label}
        </span>

        {/* Chevron */}
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${hasActive ? 'text-violet-400/60' : 'text-white/15'}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown items */}
      <div
        className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="ml-[18px] pl-4 border-l border-white/[0.06] py-1 space-y-0.5">
          {section.items.map((item) => {
            const active = isItemActive(item, pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`block px-3 py-[7px] rounded-md text-[13px] font-medium transition-all
                  ${active
                    ? 'text-white bg-violet-600/15 border border-violet-500/20'
                    : 'text-white/35 hover:text-white/70 hover:bg-white/[0.04]'
                  }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ───── MAIN SIDEBAR ───── */
export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#0B0B14]/95 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center">
            <Image src="/logo-icon.png" alt="MatchMind" width={32} height={32} className="object-contain" />
          </div>
          <div className="text-white font-bold text-lg tracking-tight">
            Match<span className="text-violet-400">Mind</span>
          </div>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-white/60 hover:text-white p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 w-60 bg-[#0B0B14] border-r border-white/[0.07] z-30 flex flex-col transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>

        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <Image src="/logo-icon.png" alt="MatchMind" width={32} height={32} className="object-contain" />
            </div>
            <div>
              <div className="text-white font-bold text-base tracking-tight leading-tight">
                Match<span className="text-violet-400">Mind</span>
              </div>
              <div className="text-white/25 text-[10px]">AI Football Intelligence</div>
            </div>
          </div>
        </div>

        {/* Collapsible nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {SECTIONS.map((section) => (
            <SidebarSection
              key={section.key}
              section={section}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/[0.07]">
          <div className="px-3 pb-1.5">
            <p className="text-white/20 text-[11px] truncate">{email}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  )
}
