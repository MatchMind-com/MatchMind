'use client'

import { useState } from 'react'
import { Sparkles, Send, Bot } from 'lucide-react'
import { BetSlip } from '@/lib/types'

const PROMPT_SUGGESTIONS = [
  'Analyze my recent bets',
  'What am I doing wrong?',
  'How can I improve my ROI?',
  'What bet types perform best for me?',
  'Suggest a bankroll management strategy',
]

interface AICoachingProps {
  userId: string
  bets: BetSlip[]
}

export default function AICoaching({ userId, bets }: AICoachingProps) {
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt
    if (!finalPrompt.trim()) return

    setLoading(true)
    setError('')
    setResponse('')

    // Build bet history context
    const recentBets = bets.slice(0, 20)
    const betHistory = recentBets.map((b) => ({
      date: b.match_date,
      match: b.match_name,
      betType: b.bet_type,
      odds: b.odds,
      stake: b.stake,
      result: b.result,
      profitLoss: b.profit_loss,
    }))

    try {
      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          betHistory,
          userId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to get coaching response')
      }

      const data = await res.json()
      setResponse(data.response)
      if (!customPrompt) setPrompt('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestion = (suggestion: string) => {
    setPrompt(suggestion)
    handleSubmit(suggestion)
  }

  return (
    <div className="card flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#3B5BDB]/20 rounded-lg">
          <Sparkles size={20} className="text-[#3B5BDB]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">AI Coaching</h2>
          <p className="text-gray-400 text-xs">Powered by GPT-4o</p>
        </div>
      </div>

      {/* Prompt suggestions */}
      <div className="flex flex-wrap gap-2">
        {PROMPT_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => handleSuggestion(s)}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-[#0F1117] border border-[#2D3152] hover:border-[#3B5BDB] text-gray-300 hover:text-white rounded-full transition-all duration-200 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask your AI coach anything about your betting performance..."
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) handleSubmit()
          }}
          className="input-field resize-none flex-1 text-sm"
        />
        <button
          onClick={() => handleSubmit()}
          disabled={loading || !prompt.trim()}
          className="btn-primary px-4 self-end flex items-center gap-2 whitespace-nowrap"
        >
          {loading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <Send size={16} />
          )}
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#FF4757]/10 border border-[#FF4757]/30 rounded-lg px-4 py-3">
          <p className="text-[#FF4757] text-sm">{error}</p>
        </div>
      )}

      {/* Response */}
      {response && (
        <div className="bg-[#0F1117] border border-[#2D3152] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bot size={16} className="text-[#00C896]" />
            <span className="text-xs font-semibold text-[#00C896] uppercase tracking-wide">
              Coach Response
            </span>
          </div>
          <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
            {response}
          </div>
        </div>
      )}

      {bets.length === 0 && (
        <p className="text-gray-500 text-xs text-center">
          Add some bet slips first to get personalized coaching insights.
        </p>
      )}
    </div>
  )
}
