'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Tab = 'login' | 'signup'

interface AuthFormProps {
  defaultTab?: Tab
}

export default function AuthForm({ defaultTab = 'login' }: AuthFormProps) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (activeTab === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
          },
        })

        if (signUpError) throw signUpError

        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').insert({
            user_id: data.user.id,
            username: username || email.split('@')[0],
            email,
          })

          if (profileError && profileError.code !== '23505') {
            console.error('Profile creation error:', profileError)
          }

          router.push('/dashboard')
          router.refresh()
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) throw signInError

        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const switchTab = (tab: Tab) => {
    setActiveTab(tab)
    setError('')
    setEmail('')
    setPassword('')
    setUsername('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#09090C' }}>
      <div className="w-full max-w-[400px]">

        {/* Wordmark */}
        <div className="text-center mb-10">
          <a href="/" className="inline-block">
            <span className="font-black text-[28px] tracking-[-0.04em]" style={{ color: '#EDE9DF' }}>
              MATCH<span style={{ color: '#F97316' }}>MIND</span>
            </span>
          </a>
          <p className="text-[13px] mt-2" style={{ color: '#6B6860' }}>
            AI football analytics — find value, track bets.
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#0E0E12', border: '1px solid #1A1A22', padding: '32px' }}>

          {/* Tabs */}
          <div className="flex" style={{ marginBottom: '28px', borderBottom: '1px solid #1A1A22' }}>
            {(['login', 'signup'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                className="flex-1 py-2.5 text-[12px] font-bold uppercase tracking-[0.1em] transition-colors"
                style={{
                  color: activeTab === tab ? '#F97316' : '#6B6860',
                  borderBottom: activeTab === tab ? '2px solid #F97316' : '2px solid transparent',
                  marginBottom: '-1px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #F97316' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {tab === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'signup' && (
              <div>
                <label className="label">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                  className="input-field"
                  required={activeTab === 'signup'}
                />
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={activeTab === 'signup' ? 'Min 6 characters' : '••••••••'}
                className="input-field"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(255,51,85,0.08)', border: '1px solid rgba(255,51,85,0.25)', padding: '12px 16px' }}>
                <p style={{ color: '#FF3355', fontSize: '13px' }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 font-mono font-black py-3"
              style={{
                background: '#F97316',
                color: '#fff',
                fontSize: '12px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
                border: 'none',
                marginTop: '8px',
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {activeTab === 'login' ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                activeTab === 'login' ? 'Sign in →' : 'Start free →'
              )}
            </button>
          </form>

          <p className="text-center text-[12px] mt-6" style={{ color: '#6B6860' }}>
            {activeTab === 'login' ? (
              <>
                No account?{' '}
                <button
                  onClick={() => switchTab('signup')}
                  className="font-semibold transition-colors"
                  style={{ color: '#F97316', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Sign up free
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => switchTab('login')}
                  className="font-semibold transition-colors"
                  style={{ color: '#F97316', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        {/* Responsible gambling */}
        <p className="text-center text-[11px] mt-6 leading-relaxed" style={{ color: '#3A3A48' }}>
          <span style={{ background: 'rgba(255,51,85,0.1)', color: '#FF3355', border: '1px solid rgba(255,51,85,0.2)', padding: '1px 6px', marginRight: '6px', fontWeight: 700 }}>18+</span>
          Analytics only — not financial advice.{' '}
          <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" style={{ color: '#6B6860', textDecoration: 'underline' }}>BeGambleAware.org</a>
        </p>
      </div>
    </div>
  )
}
