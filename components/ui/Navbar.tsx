'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function Navbar({ email }: { email: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function signOut() {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="border-b border-white/5 bg-[#0B0B14]/90 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/>
              </svg>
            </div>
            <div>
              <span className="text-white font-bold text-xl tracking-tight">Bet<span className="text-violet-400">IQ</span></span>
              <div className="text-[10px] text-slate-500 -mt-1 leading-none">AI Betting Coach</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-slate-300 text-sm">{email}</span>
            </div>
            <button onClick={signOut} disabled={loading}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-all px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              {loading ? 'Signing out...' : 'Logout'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
