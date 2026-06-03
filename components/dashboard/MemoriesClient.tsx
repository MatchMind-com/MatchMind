'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'

type Memory = {
  id: string
  content: string
  role: 'user' | 'assistant'
  similarity?: number
  created_at: string
}

function dayKey(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function MemoriesClient() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [notReady, setNotReady] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/memories')
      const json = await res.json()
      setMemories(json.memories || [])
      setTotalCount(json.count || 0)
      setNotReady(!!json.notReady)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function runSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) {
      setActiveQuery('')
      load()
      return
    }
    setSearching(true)
    setActiveQuery(q)
    try {
      const res = await fetch(`/api/memories?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setMemories(json.memories || [])
    } finally {
      setSearching(false)
    }
  }

  function clearSearch() {
    setQuery('')
    setActiveQuery('')
    load()
  }

  async function forget(id: string) {
    if (!confirm('Forget this memory? The Coach will no longer recall it.')) return
    const prev = memories
    setMemories(m => m.filter(x => x.id !== id))
    setTotalCount(c => Math.max(0, c - 1))
    const res = await fetch(`/api/memories?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) {
      setMemories(prev) // rollback
      alert('Could not delete that memory. Try again.')
    }
  }

  const grouped = useMemo(() => {
    if (activeQuery) return null
    const map = new Map<string, Memory[]>()
    for (const m of memories) {
      const k = dayKey(m.created_at)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(m)
    }
    return Array.from(map.entries())
  }, [memories, activeQuery])

  return (
    <div className="min-h-screen bg-[#09090C] text-white px-4 lg:px-8 py-6 lg:py-10 pt-20 lg:pt-10">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight">
            Memory <span className="text-orange-400">Lane</span>
          </h1>
          <p className="text-white/50 text-sm mt-2 max-w-2xl">
            Everything your Coach remembers about you. The more you chat, the sharper its advice gets —
            three months from now it&apos;ll still know your dad watches every Galatasaray match with you.
          </p>
        </div>

        {/* Stats card */}
        <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 p-5 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-orange-400"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.16z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.16z"/></svg>
            </div>
            <div>
              <div className="text-2xl font-black text-white">
                Coach remembers {totalCount.toLocaleString()} {totalCount === 1 ? 'thing' : 'things'} about you
              </div>
              <div className="text-white/40 text-xs mt-0.5">
                Stored as vector embeddings — recalled by meaning, not keywords.
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={runSearch} className="flex gap-2 mb-6">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by meaning — try 'my favourite team' or 'losing streaks'"
            className="flex-1 bg-white/[0.04] border border-white/10 px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:border-orange-500/40 focus:bg-white/[0.06] transition"
          />
          <button
            type="submit"
            disabled={searching}
            className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 px-5 py-3 text-sm font-bold text-black transition"
          >
            {searching ? '…' : 'Recall'}
          </button>
          {activeQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 transition"
            >
              Clear
            </button>
          )}
        </form>

        {activeQuery && (
          <div className="text-xs text-white/40 mb-4">
            Top matches for <span className="text-orange-400 font-semibold">&ldquo;{activeQuery}&rdquo;</span> — ranked by semantic similarity.
          </div>
        )}

        {/* States */}
        {loading && (
          <div className="text-center py-16 text-white/30 text-sm">Loading memories…</div>
        )}

        {!loading && notReady && (
          <div className="bg-amber-500/5 border border-amber-500/20 p-6 text-amber-200/80 text-sm">
            <div className="font-bold text-amber-300 mb-1">Memory Lane needs a one-time setup.</div>
            Run <code className="px-1.5 py-0.5 bg-black/30 text-amber-200">supabase/memory-lane.sql</code> in your Supabase SQL editor to enable persistent memory.
          </div>
        )}

        {!loading && !notReady && memories.length === 0 && (
          <div className="bg-white/[0.03] border border-white/10 p-10 text-center">
            <div className="text-white/70 font-semibold mb-1">No memories yet</div>
            <div className="text-white/40 text-sm">
              Chat with your Coach — every exchange becomes a memory it can recall later.
            </div>
          </div>
        )}

        {/* Search results — flat list with similarity */}
        {!loading && activeQuery && memories.length > 0 && (
          <div className="space-y-3">
            {memories.map(m => (
              <MemoryCard key={m.id} memory={m} onForget={() => forget(m.id)} showSimilarity />
            ))}
          </div>
        )}

        {/* List mode — grouped by day */}
        {!loading && !activeQuery && grouped && grouped.length > 0 && (
          <div className="space-y-8">
            {grouped.map(([day, items]) => (
              <div key={day}>
                <div className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-3 px-1">
                  {day} <span className="text-white/20 ml-2">· {items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map(m => (
                    <MemoryCard key={m.id} memory={m} onForget={() => forget(m.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MemoryCard({
  memory,
  onForget,
  showSimilarity,
}: {
  memory: Memory
  onForget: () => void
  showSimilarity?: boolean
}) {
  const isUser = memory.role === 'user'
  return (
    <div className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.12] p-4 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                isUser
                  ? 'bg-white/[0.06] text-[#6B6860] border border-white/[0.08]'
                  : 'bg-orange-500/15 text-orange-300 border border-orange-500/25'
              }`}
            >
              {isUser ? 'You said' : 'Coach said'}
            </span>
            {showSimilarity && typeof memory.similarity === 'number' && (
              <span className="text-[10px] text-white/40 font-mono">
                {(memory.similarity * 100).toFixed(0)}% match
              </span>
            )}
            <span className="text-[10px] text-white/25 ml-auto">
              {new Date(memory.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap break-words">
            {memory.content}
          </p>
        </div>
        <button
          onClick={onForget}
          className="opacity-0 group-hover:opacity-100 text-[11px] font-semibold text-white/40 hover:text-red-400 transition shrink-0"
          title="Forget this memory"
        >
          Forget
        </button>
      </div>
    </div>
  )
}
