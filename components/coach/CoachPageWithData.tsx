'use client'
import { useState, useRef, useEffect } from 'react'
import LiveFootballData from '@/components/football/LiveFootballData'
import NewsPanel from '@/components/coach/NewsPanel'

interface Message { role: 'user' | 'assistant'; content: string }

const QUICK_PROMPTS = [
  { label: 'Best bets today', msg: "What are the best value bets for today's fixtures?" },
  { label: 'Analyse my bets', msg: 'Analyse my recent betting history and identify my weaknesses.' },
  { label: 'In-form teams', msg: 'Which teams are in the best form right now and worth backing?' },
  { label: 'Clean sheet tips', msg: 'Which teams have the best defensive record for clean sheet bets?' },
  { label: 'BTTS picks', msg: 'Which upcoming matches are best for both teams to score?' },
  { label: 'Value odds', msg: 'Where can I find value in the odds for upcoming matches?' },
]

function SendIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  )
}

export default function CoachPageWithData({ user, profile }: { user: any; profile: any }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Welcome to MatchMind Coach! I'm loaded with today's live fixtures, standings, and your betting history. Ask me anything — from today's best bets to analysing your form. What do you want to know?"
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [league, setLeague] = useState('39')
  const [tab, setTab] = useState<'chat' | 'news'>('chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    const userMsg: Message = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/coach-with-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-8),
          leagueId: league,
        }),
      })
      const data = await res.json()
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I ran into an error. Please try again.' }])
    }
    setLoading(false)
  }

  return (
    <div className="flex h-full gap-4 p-4 lg:p-6 max-w-7xl mx-auto w-full">
      {/* Left: Football data sidebar */}
      <div className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 gap-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Live Football Data</p>
        <LiveFootballData onLeagueChange={setLeague} />
      </div>

      {/* Center: Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0E1628] rounded-2xl border border-white/[0.07] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-white">MatchMind Coach</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Live data connected
              </div>
            </div>
          </div>
          {/* Mobile tabs */}
          <div className="flex lg:hidden gap-1">
            <button onClick={() => setTab('chat')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${tab === 'chat' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-500'}`}>Chat</button>
            <button onClick={() => setTab('news')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${tab === 'news' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-500'}`}>News</button>
          </div>
        </div>

        {/* Quick prompts */}
        <div className="flex gap-2 px-4 py-2.5 overflow-x-auto border-b border-white/[0.05]" style={{ scrollbarWidth: 'none' }}>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => sendMessage(p.msg)}
              disabled={loading}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-blue-500/15 text-xs text-slate-400 hover:text-white border border-white/[0.07] hover:border-blue-500/30 transition-all font-medium"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 border ${
                m.role === 'assistant'
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  : 'bg-white/10 border-white/10 text-slate-400'
              }`}>
                {m.role === 'assistant' ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                m.role === 'assistant'
                  ? 'bg-white/[0.04] border border-white/[0.06] text-slate-200 rounded-tl-sm'
                  : 'bg-blue-600 text-white rounded-tr-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] px-4 py-3 rounded-2xl rounded-tl-sm">
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/[0.07]">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about today's matches, team form, value bets..."
              className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition-colors"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      </div>

      {/* Right: News panel (desktop) */}
      <div className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Football News</p>
        <NewsPanel />
      </div>
    </div>
  )
}
