'use client'
import { useState, useRef, useEffect } from 'react'
import { BetSlip } from '@/lib/types'

type Message = { role: 'user' | 'assistant'; content: string }

const SUGGESTED_QUESTIONS = [
  "What are the biggest matches this weekend?",
  "Analyse my betting patterns and tell me where I'm losing money",
  "Which leagues are best for value bets?",
  "What's your prediction for the Champions League this season?",
  "How should I manage my bankroll better?",
  "What are the most profitable bet types statistically?",
]

export default function CoachPage({ userId, bets }: { userId: string; bets: BetSlip[] }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I'm your BetIQ Football Coach — your AI expert for football insights, match analysis, betting strategy, and news. I also have access to your betting history so I can give you truly personalised advice.\n\nWhat would you like to know? You can ask me about upcoming matches, team form, leagues, betting strategies, or I can analyse your personal stats." }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage(text?: string) {
    const content = text || input.trim()
    if (!content || loading) return
    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const res = await fetch('/api/football-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, bets }),
      })
      const data = await res.json()
      if (res.ok) setMessages(m => [...m, { role: 'assistant', content: data.message }])
      else setMessages(m => [...m, { role: 'assistant', content: `Sorry, I encountered an error: ${data.error || 'Unknown error'}` }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Network error. Please check your connection and try again.' }])
    }
    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="flex flex-col h-screen lg:h-[calc(100vh)] max-h-screen">
      <div className="px-4 sm:px-6 lg:px-8 py-6 border-b border-white/5 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">Football AI Coach</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
              <span className="text-slate-400 text-xs">Online · Ask me anything about football & betting</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-tr-sm'
                  : 'bg-[#13131F] border border-white/5 text-slate-200 rounded-tl-sm'
              }`}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-300"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <div className="bg-[#13131F] border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center h-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{animationDelay:'0ms'}}/>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{animationDelay:'150ms'}}/>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{animationDelay:'300ms'}}/>
                </div>
              </div>
            </div>
          )}

          {messages.length === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)}
                  className="text-left text-xs text-slate-400 hover:text-white bg-white/3 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl p-3 transition-all">
                  {q}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-4 border-t border-white/5 shrink-0 bg-[#0B0B14]">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end bg-[#13131F] border border-white/10 rounded-2xl p-3 focus-within:border-violet-500/50 transition-colors">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Ask about matches, teams, leagues, betting strategy..."
              rows={1} disabled={loading}
              className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 resize-none focus:outline-none max-h-32 leading-relaxed"/>
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
              className="w-9 h-9 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all shrink-0 shadow-lg shadow-violet-500/20">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <p className="text-slate-600 text-xs text-center mt-2">Powered by GPT-4o · Knowledge up to early 2025 · For entertainment purposes</p>
        </div>
      </div>
    </div>
  )
}
