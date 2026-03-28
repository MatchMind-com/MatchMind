'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV = [
  { href: '/dashboard', label: 'Command Center', icon: '🏠', exact: true },
  { href: '/dashboard/statistics', label: 'Statistics', icon: '📊', exact: false },
  { href: '/dashboard/bankroll', label: 'Bankroll', icon: '💰', exact: false },
  { href: '/dashboard/suggestions', label: 'AI Suggestions', icon: '🧠', exact: false },
  { href: '/dashboard/coach', label: 'Football Coach', icon: '⚽', exact: false },
  { href: '/dashboard/billing', label: 'Billing', icon: '💳', exact: false },
]

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
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
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-violet-500/25">B</div>
          <div>
            <span className="text-white font-bold text-lg tracking-tight">Bet<span className="text-violet-400">IQ</span></span>
          </div>
        </div>
        <button onClick={() => setOpen(!open)} className="text-white/60 hover:text-white p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 w-64 bg-[#0B0B14] border-r border-white/10 z-30 flex flex-col transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>

        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-violet-500/25">B</div>
            <div>
              <div className="text-white font-bold text-xl tracking-tight leading-tight">
                Bet<span className="text-violet-400">IQ</span>
              </div>
              <div className="text-white/30 text-xs">AI Betting Coach</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${isActive
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30 shadow-sm'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <div className="px-4 py-2">
            <p className="text-white/25 text-xs truncate">{email}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <span>🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}
