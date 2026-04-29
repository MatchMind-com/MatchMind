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
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function MemoriesDrawer({
  open,
  onClose,
  refreshKey,
}: {
  open: boolean
  onClose: () => void
  /** bump to force a refetch (e.g. after a new chat exchange) */
  refreshKey?: number
}) {
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

  // Load on open + when refreshKey changes (and drawer is open)
  useEffect(() => {
    if (open) load()
  }, [open, refreshKey, load])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
      setMemories(prev)
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
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] lg:w-[480px] bg-[#0E1628] border-l border-white/[0.07] z-50 flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-lg">
              🧠
            </div>
            <div>
              <div className="text-sm font-bold text-white">Coach Memory</div>
              <div className="text-[10px] text-slate-400">What I remember about you</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white flex items-center justify-center transition"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Stats card */}
          <div className="rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 p-4">
            <div className="text-lg font-black text-white leading-tight">
              Coach remembers {totalCount.toLocaleString()} {totalCount === 1 ? 'thing' : 'things'} about you
            </div>
            <div className="text-white/40 text-[11px] mt-1">
              Stored as vector embeddings — recalled by meaning, not keywords.
            </div>
          </div>

          {/* Search */}
          <form onSubmit={runSearch} className="flex gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by meaning…"
              className="flex-1 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm placeholder:text-white/30 focus:outline-none focus:border-orange-500/40 focus:bg-white/[0.06] transition"
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 px-4 py-2.5 text-xs font-bold text-black transition"
            >
              {searching ? '…' : 'Recall'}
            </button>
            {activeQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 px-3 py-2.5 text-xs font-semibold text-white/70 transition"
              >
                Clear
              </button>
            )}
          </form>

          {activeQuery && (
            <div className="text-[11px] text-white/40">
              Top matches for <span className="text-orange-400 font-semibold">&ldquo;{activeQuery}&rdquo;</span>.
            </div>
          )}

          {/* States */}
          {loading && (
            <div className="text-center py-12 text-white/30 text-sm">Loading memories…</div>
          )}

          {!loading && notReady && (
            <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-4 text-amber-200/80 text-xs">
              <div className="font-bold text-amber-300 mb-1">Memory needs a one-time setup.</div>
              Run <code className="px-1.5 py-0.5 rounded bg-black/30 text-amber-200">supabase/memory-lane.sql</code> in your Supabase SQL editor.
            </div>
          )}

          {!loading && !notReady && memories.length === 0 && (
            <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-8 text-center">
              <div className="text-3xl mb-2">💭</div>
              <div className="text-white/70 font-semibold mb-1 text-sm">No memories yet</div>
              <div className="text-white/40 text-xs">
                Chat with your Coach — every exchange becomes a memory.
              </div>
            </div>
          )}

          {/* Search results */}
          {!loading && activeQuery && memories.length > 0 && (
            <div className="space-y-2.5">
              {memories.map(m => (
                <MemoryCard key={m.id} memory={m} onForget={() => forget(m.id)} showSimilarity />
              ))}
            </div>
          )}

          {/* Grouped by day */}
          {!loading && !activeQuery && grouped && grouped.length > 0 && (
            <div className="space-y-6">
              {grouped.map(([day, items]) => (
                <div key={day}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2 px-1">
                    {day} <span className="text-white/20 ml-1">· {items.length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {items.map(m => (
                      <MemoryCard key={m.id} memory={m} onForget={() => forget(m.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
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
    <div className="group rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.12] p-3 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                isUser
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                  : 'bg-orange-500/15 text-orange-300 border border-orange-500/25'
              }`}
            >
              {isUser ? 'You said' : 'Coach said'}
            </span>
            {showSimilarity && typeof memory.similarity === 'number' && (
              <span className="text-[9px] text-white/40 font-mono">
                {(memory.similarity * 100).toFixed(0)}%
              </span>
            )}
            <span className="text-[9px] text-white/25 ml-auto">
              {new Date(memory.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap break-words">
            {memory.content}
          </p>
        </div>
        <button
          onClick={onForget}
          className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-white/40 hover:text-red-400 transition shrink-0"
          title="Forget this memory"
        >
          Forget
        </button>
      </div>
    </div>
  )
}
