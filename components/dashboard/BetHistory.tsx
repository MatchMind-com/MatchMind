'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BetSlip } from '@/lib/types'

function exportToCSV(bets: BetSlip[]) {
  const headers = ['Date','Match','League','Bet Type','Selection','Odds','Stake','Return','Result','P&L','Notes']
  const rows = bets.map(b => [
    b.match_date||b.created_at?.split('T')[0]||'', b.match_name, b.league||'',
    b.bet_type, b.selection, b.odds, b.stake,
    b.potential_return?.toFixed(2)||'', b.result,
    Number(b.profit_loss)>=0 ? `+${Number(b.profit_loss).toFixed(2)}` : Number(b.profit_loss).toFixed(2),
    b.notes||'',
  ])
  const csv = [headers,...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv],{type:'text/csv'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href=url; a.download=`matchmind-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url)
}

// Can a bet be auto-detected? Needs fixture_id and a detectable market
function canAutoDetect(bet: BetSlip): boolean {
  if (!bet.fixture_id) return false
  const t = (bet.bet_type || '').toLowerCase()
  // Corners, cards, correct score, HT, goalscorers can't be auto-detected
  if (t.includes('corner') || t.includes('card') || t.includes('correct score') ||
      t.includes('goalscorer') || t.includes('half') || t.includes('ht')) return false
  return true
}

function AutoDetectBadge({ bet }: { bet: BetSlip }) {
  if (bet.result !== 'pending') return null
  if (canAutoDetect(bet)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" strokeOpacity=".3"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        Auto-detecting
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 rounded-full">
      Manual only
    </span>
  )
}

export default function BetHistory({ bets, onUpdate }: { bets: BetSlip[]; onUpdate: () => void }) {
  const supabase = createClient()
  const [filter, setFilter] = useState<'all'|'pending'|'win'|'loss'|'void'>('all')
  const [updatingId, setUpdatingId] = useState<string|null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string|null>(null)
  const [expandedOverride, setExpandedOverride] = useState<string|null>(null)

  const filtered = filter === 'all' ? bets : bets.filter(b => b.result === filter)

  // Manual override (kept for bets that can't be auto-detected, or as fallback)
  async function setResult(bet: BetSlip, result: 'win'|'loss'|'void'|'pending') {
    setUpdatingId(bet.id)
    const pl = result==='win' ? (Number(bet.odds)-1)*Number(bet.stake) : result==='loss' ? -Number(bet.stake) : 0
    await supabase.from('bet_slips').update({ result, profit_loss: pl }).eq('id', bet.id)
    setUpdatingId(null)
    setExpandedOverride(null)
    onUpdate()
  }

  async function deleteBet(id: string) {
    await supabase.from('bet_slips').delete().eq('id', id); onUpdate()
  }

  async function refreshResults() {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const res = await fetch('/api/cron/check-bet-slips', {
        headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'cron'}` },
      })
      const json = await res.json()
      if (json.checked !== undefined) {
        const parts = []
        if (json.wins > 0) parts.push(`${json.wins} won`)
        if (json.losses > 0) parts.push(`${json.losses} lost`)
        if (json.voided > 0) parts.push(`${json.voided} voided`)
        if (json.checked === 0) setRefreshMsg('No settled bets found yet')
        else setRefreshMsg(`Updated: ${parts.join(', ')} (${json.checked} checked)`)
        onUpdate()
      } else {
        setRefreshMsg(json.message || 'Done')
      }
    } catch {
      setRefreshMsg('Error — try again')
    } finally {
      setRefreshing(false)
      setTimeout(() => setRefreshMsg(null), 5000)
    }
  }

  const badge: Record<string,string> = {
    win:'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    loss:'bg-red-500/15 text-red-400 border-red-500/20',
    void:'bg-slate-500/15 text-slate-400 border-slate-500/20',
    pending:'bg-amber-500/15 text-amber-400 border-amber-500/20',
  }

  const pendingCount = bets.filter(b => b.result === 'pending').length

  return (
    <div className="bg-[#13131F] border border-white/5 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </div>
          <div>
            <h2 className="text-white font-semibold">Bet History</h2>
            <p className="text-slate-500 text-xs">{filtered.length} of {bets.length} bets{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh Results button */}
          <button
            onClick={refreshResults}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={refreshing ? 'animate-spin' : ''}>
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {refreshing ? 'Checking...' : 'Refresh Results'}
          </button>
          {bets.length > 0 && (
            <button onClick={() => exportToCSV(bets)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-all">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Refresh status message */}
      {refreshMsg && (
        <div className="mb-4 text-xs text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2">
          {refreshMsg}
        </div>
      )}

      {/* Auto-detect info banner (show when there are pending bets with fixture_id) */}
      {bets.some(b => b.result === 'pending' && canAutoDetect(b)) && (
        <div className="mb-4 flex items-start gap-2 text-xs text-slate-400 bg-white/3 border border-white/5 rounded-lg px-3 py-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-400 shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span>Results are checked automatically each night. Click <strong className="text-sky-400">Refresh Results</strong> to check now for any matches that have finished.</span>
        </div>
      )}

      <div className="flex gap-1 mb-4 bg-[#0B0B14] p-1 rounded-xl w-fit">
        {(['all','pending','win','loss','void'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium capitalize ${filter===f ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
            {f === 'win' ? 'Won' : f === 'loss' ? 'Lost' : f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <p className="text-slate-400 font-medium">No bets here</p>
          <p className="text-slate-600 text-sm mt-1">Add your first bet slip above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(bet => {
            const autoable = canAutoDetect(bet)
            const isOverrideOpen = expandedOverride === bet.id
            const isAcca = bet.bet_type === 'Accumulator'

            // Parse ACCA legs for display
            let accaLegs: { match_name: string; selection: string; odds: number; bet_type: string }[] = []
            if (isAcca && bet.notes) {
              try { accaLegs = JSON.parse(bet.notes) } catch {}
            }

            return (
              <div key={bet.id} className={`bg-[#0B0B14] border rounded-xl p-4 transition-all ${updatingId===bet.id ? 'opacity-50' : 'border-white/5 hover:border-white/10'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-white font-medium text-sm">{bet.match_name}</span>
                      {bet.league && <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{bet.league}</span>}
                      {isAcca && <span className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">ACCA ×{accaLegs.length || '?'}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      <span>{bet.bet_type}</span><span className="text-slate-700">•</span>
                      {!isAcca && <><span className="text-slate-300">{bet.selection}</span><span className="text-slate-700">•</span></>}
                      <span>@{Number(bet.odds).toFixed(2)}</span><span className="text-slate-700">•</span>
                      <span>Stake: {Number(bet.stake).toFixed(2)}</span>
                      {bet.match_date && <><span className="text-slate-700">•</span><span>{new Date(bet.match_date).toLocaleDateString()}</span></>}
                      {bet.bookmaker && <><span className="text-slate-700">•</span><span className="text-slate-400">{bet.bookmaker}</span></>}
                    </div>

                    {/* ACCA legs */}
                    {isAcca && accaLegs.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {accaLegs.map((leg, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="text-slate-700 shrink-0">└</span>
                            <span className="text-slate-400">{leg.match_name}</span>
                            <span className="text-slate-700">•</span>
                            <span>{leg.selection}</span>
                            <span className="text-slate-700">•</span>
                            <span>@{Number(leg.odds).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Auto-detect badge for pending bets */}
                    {bet.result === 'pending' && (
                      <div className="mt-1.5">
                        <AutoDetectBadge bet={bet} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-1 rounded-lg border ${badge[bet.result]}`}>
                      {bet.result==='pending'?'⏳ Pending':bet.result==='win'?'✓ Won':bet.result==='loss'?'✗ Lost':'○ Void'}
                    </span>
                    {bet.result !== 'pending' && bet.result !== 'void' && (
                      <span className={`text-xs font-bold ${Number(bet.profit_loss)>=0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {Number(bet.profit_loss)>=0?'+':''}{Number(bet.profit_loss).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer actions */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                  {/* Override toggle — always available */}
                  <button
                    onClick={() => setExpandedOverride(isOverrideOpen ? null : bet.id)}
                    className="text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    {isOverrideOpen ? 'Close' : 'Override'}
                  </button>

                  {/* For non-autoable pending bets, also show inline manual buttons */}
                  {bet.result === 'pending' && !autoable && (
                    <>
                      <span className="text-slate-700 text-xs">•</span>
                      <span className="text-slate-600 text-xs">Mark as:</span>
                      <button onClick={() => setResult(bet,'win')} className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg transition-all">✓ Won</button>
                      <button onClick={() => setResult(bet,'loss')} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded-lg transition-all">✗ Lost</button>
                      <button onClick={() => setResult(bet,'void')} className="text-xs bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/20 px-2.5 py-0.5 rounded-lg transition-all">○ Void</button>
                    </>
                  )}

                  <button onClick={() => deleteBet(bet.id)} className="ml-auto text-xs text-slate-600 hover:text-red-400 transition-colors p-1">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                </div>

                {/* Override panel */}
                {isOverrideOpen && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap bg-white/3 rounded-lg px-3 py-2">
                    <span className="text-slate-500 text-xs">Manual override:</span>
                    {bet.result !== 'win' && <button onClick={() => setResult(bet,'win')} className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-lg transition-all">✓ Won</button>}
                    {bet.result !== 'loss' && <button onClick={() => setResult(bet,'loss')} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1 rounded-lg transition-all">✗ Lost</button>}
                    {bet.result !== 'pending' && <button onClick={() => setResult(bet,'pending')} className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-lg transition-all">⏳ Pending</button>}
                    {bet.result !== 'void' && <button onClick={() => setResult(bet,'void')} className="text-xs bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/20 px-3 py-1 rounded-lg transition-all">○ Void</button>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
