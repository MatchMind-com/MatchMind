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
          // Create profile row
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
    <div className="min-h-screen bg-[#0F1117] flex items-center justify-center px-4">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            FootballBetAI ⚽
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Your AI-powered betting performance coach
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#1A1D2E] border border-[#2D3152] rounded-[12px] p-8">
          {/* Tabs */}
          <div className="flex rounded-lg bg-[#0F1117] p-1 mb-6">
            <button
              onClick={() => switchTab('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'login'
                  ? 'bg-[#3B5BDB] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => switchTab('signup')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'signup'
                  ? 'bg-[#3B5BDB] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
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
              <label className="label">Email Address</label>
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
                placeholder={activeTab === 'signup' ? 'Minimum 6 characters' : '••••••••'}
                className="input-field"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-[#FF4757]/10 border border-[#FF4757]/30 rounded-lg px-4 py-3">
                <p className="text-[#FF4757] text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
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
                activeTab === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            {activeTab === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => switchTab('signup')}
                  className="text-[#3B5BDB] hover:underline font-medium"
                >
                  Sign up free
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => switchTab('login')}
                  className="text-[#3B5BDB] hover:underline font-medium"
                >
                  Log in
                </button>
              </>
            )}
          </p>
        </div>

        {/* Responsible gambling */}
        <p className="text-center text-white/30 text-[11px] mt-6 leading-relaxed">
          <span className="bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded mr-1.5 font-semibold">18+</span>
          Gambling involves risk. For analytics only — not financial advice.{' '}
          <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/60">BeGambleAware.org</a>
        </p>
      </div>
    </div>
  )
}
