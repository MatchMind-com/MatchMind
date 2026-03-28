'use client'
import { useState, useRef, useEffect } from 'react'
import LiveFootballData from '@/components/football/LiveFootballData'
import NewsPanel from '@/components/coach/NewsPanel'

interface Message { role: 'user' | 'assistant'; content: string }

const QUICK_PROMPTS = [
  { label: '⚽ Best bets today', msg: "What are the best value bets for today's fixtures?" },
  { label: '📊 Analyse my bets', msg: 'Analyse my recent betting history and identify my weaknesses.' },
  { label: '🔥 In-form teams', msg: 'Which teams are in the best form right now and worth backing?' },
  { label: '🛡️ Clean sheet tips', msg: 'Which teams have the best defensive record for clean sheet bets?' },
  { label: '⚡ BTTS picks', msg: 'Which upcoming matches are best for both teams to score?' },
  { label: '💰 Value odds', msg: 'Where can I find value in the odds for upcoming matches?' },
]

export default function CoachPageWithData({ user, profile }: { user: any; profile: any }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Welcome to BetIQ Coach! 🏆 I'm loaded with today's live fixtures, standings, and your betting history. Ask me anything — from today's best bets to analysing your form. What do you want to know?"
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
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Live Football Data</h3>
          <LiveFootballData onLeagueChange={setLeague} />
        </div>
      </div>

      {/* Center: Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#12121F] rounded-xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-sm font-bold">
              🤖
            </div>
            <div>
              <div className="text-sm font-semibold text-white">BetIQ Coach</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Live data connected
              </div>
            </div>
          </div>
          {/* Mobile tabs */}
          <div className="flex lg:hidden gap-1">
            <button onClick={() => setTab('chat')} className={`px-3 py-1 rounded text-xs ${tab === 'chat' ? 'bg-violet-600 text-white' : 'text-gray-400'}`}>Chat</button>
            <button onClick={() => setTab('news')} className={`px-3 py-1 rounded text-xs ${tab === 'news' ? 'bg-violet-600 text-white' : 'text-gray-400'}`}>News</button>
          </div>
        </div>

        {/* Quick prompts */}
        <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-white/5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => sendMessage(p.msg)}
              disabled={loading}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-violet-600/30 text-xs text-gray-300 hover:text-white border border-white/10 hover:border-violet-500/50 transition-all"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                m.role === 'assistant'
                  ? 'bg-gradient-to-br from-violet-600 to-indigo-600'
                  : 'bg-gradient-to-br from-emerald-600 to-teal-600'
              }`}>
                {m.role === 'assistant' ? '🤖' : '👤'}
              </div>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                m.role === 'assistant'
                  ? 'bg-[#1A1A2E] text-gray-100 rounded-tl-sm'
                  : 'bg-violet-600 text-white rounded-tr-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs">🤖</div>
              <div className="bg-[#1A1A2E] px-4 py-3 rounded-2xl rounded-tl-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about today's matches, team form, value bets..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl transition-colors font-medium text-sm"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Right: News panel (desktop) */}
      <div className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Football News</h3>
        <NewsPanel />
      </div>
    </div>
  )
}
