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

function ShareModal({ bet, onClose }: { bet: BetSlip; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const pl = Number(bet.profit_loss)
  const isWin = bet.result === 'win'
  const pnlStr = `${pl >= 0 ? '+' : ''}£${Math.abs(pl).toFixed(2)}`

  const shareText = `${isWin ? '🔥 Won' : '✅'} ${bet.match_name}\n${bet.selection} @ ${Number(bet.odds).toFixed(2)}\n${bet.bet_type} · Stake £${Number(bet.stake).toFixed(2)} · P&L ${pnlStr}\n\nTracked with MatchMind — AI Betting Coach 📊\nmatchmindcom.company`

  async function copyText() {
    await navigator.clipboard.writeText(shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
        {/* The shareable card */}
        <div className={`rounded-2xl p-6 mb-4 border-2 ${isWin ? 'bg-gradient-to-br from-emerald-950 to-[#0B0B14] border-emerald-500/40' : 'bg-gradient-to-br from-red-950 to-[#0B0B14] border-red-500/30'}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm">B</div>
              <span className="text-white font-bold text-sm">Bet<span className="text-violet-400">IQ</span></span>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${isWin ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
              {isWin ? '✅ WON' : '❌ LOST'}
            </span>
          </div>

          {/* Match */}
          <p className="text-white font-black text-xl mb-1 leading-tight">{bet.match_name}</p>
          {bet.league && <p className="text-white/40 text-xs mb-4">{bet.league}</p>}

          {/* Bet details */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-white/40 text-[10px] uppercase tracking-wide mb-1">Pick</p>
              <p className="text-white text-sm font-bold leading-tight">{bet.selection}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-white/40 text-[10px] uppercase tracking-wide mb-1">Odds</p>
              <p className="text-white text-sm font-bold">@{Number(bet.odds).toFixed(2)}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-white/40 text-[10px] uppercase tracking-wide mb-1">Stake</p>
              <p className="text-white text-sm font-bold">£{Number(bet.stake).toFixed(2)}</p>
            </div>
          </div>

          {/* P&L */}
          <div className={`rounded-xl p-4 text-center ${isWin ? 'bg-emerald-500/15 border border-emerald-500/25' : 'bg-red-500/10 border border-red-500/20'}`}>
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Profit / Loss</p>
            <p className={`text-3xl font-black ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>{pnlStr}</p>
          </div>

          {/* Footer */}
          <p className="text-white/20 text-[10px] text-center mt-4">Tracked & verified with MatchMind · matchmindcom.company</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={copyText}
            className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
          >
            {copied ? '✓ Copied!' : '📋 Copy Text'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-white/8 hover:bg-white/12 border border-white/10 text-white/60 hover:text-white text-sm py-3 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
        <p className="text-white/25 text-xs text-center mt-3">Screenshot the card above to share on social media</p>
      </div>
    </div>
  )
}

export default function BetHistory({ bets, onUpdate }: { bets: BetSlip[]; onUpdate: () => void }) {
  const supabase = createClient()
  const [filter, setFilter] = useState<'all'|'pending'|'win'|'loss'|'void'>('all')
  const [updatingId, setUpdatingId] = useState<string|null>(null)
  const [sharingBet, setSharingBet] = useState<BetSlip|null>(null)
  const filtered = filter === 'all' ? bets : bets.filter(b => b.result === filter)

  async function setResult(bet: BetSlip, result: 'win'|'loss'|'void'|'pending') {
    setUpdatingId(bet.id)
    const pl = result==='win' ? (Number(bet.odds)-1)*Number(bet.stake) : result==='loss' ? -Number(bet.stake) : 0
    await supabase.from('bet_slips').update({ result, profit_loss: pl }).eq('id', bet.id)
    setUpdatingId(null); onUpdate()
  }

  async function deleteBet(id: string) {
    await supabase.from('bet_slips').delete().eq('id', id); onUpdate()
  }

  const badge: Record<string,string> = {
    win:'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    loss:'bg-red-500/15 text-red-400 border-red-500/20',
    void:'bg-slate-500/15 text-slate-400 border-slate-500/20',
    pending:'bg-amber-500/15 text-amber-400 border-amber-500/20',
  }

  return (
    <>
      {sharingBet && <ShareModal bet={sharingBet} onClose={() => setSharingBet(null)} />}

      <div className="bg-[#13131F] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </div>
            <div><h2 className="text-white font-semibold">Bet History</h2><p className="text-slate-500 text-xs">{filtered.length} of {bets.length} bets</p></div>
          </div>
          {bets.length > 0 && (
            <button onClick={() => exportToCSV(bets)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-all">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
          )}
        </div>
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
            {filtered.map(bet => (
              <div key={bet.id} className={`bg-[#0B0B14] border rounded-xl p-4 transition-all ${updatingId===bet.id ? 'opacity-50' : 'border-white/5 hover:border-white/10'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-white font-medium text-sm">{bet.match_name}</span>
                      {bet.league && <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{bet.league}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      <span>{bet.bet_type}</span><span className="text-slate-700">•</span>
                      <span className="text-slate-300">{bet.selection}</span><span className="text-slate-700">•</span>
                      <span>@{Number(bet.odds).toFixed(2)}</span><span className="text-slate-700">•</span>
                      <span>Stake: {Number(bet.stake).toFixed(2)}</span>
                      {bet.match_date && <><span className="text-slate-700">•</span><span>{new Date(bet.match_date).toLocaleDateString()}</span></>}
                    </div>
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
                <div className="flex gap-2 mt-3 pt-3 border-t border-white/5 flex-wrap">
                  <span className="text-slate-600 text-xs self-center">Mark as:</span>
                  {bet.result !== 'win' && <button onClick={() => setResult(bet,'win')} className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-lg transition-all">✓ Won</button>}
                  {bet.result !== 'loss' && <button onClick={() => setResult(bet,'loss')} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1 rounded-lg transition-all">✗ Lost</button>}
                  {bet.result !== 'pending' && <button onClick={() => setResult(bet,'pending')} className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-lg transition-all">⏳ Pending</button>}
                  {bet.result !== 'void' && <button onClick={() => setResult(bet,'void')} className="text-xs bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/20 px-3 py-1 rounded-lg transition-all">○ Void</button>}
                  {/* Share button — only for settled bets */}
                  {(bet.result === 'win' || bet.result === 'loss') && (
                    <button
                      onClick={() => setSharingBet(bet)}
                      className="ml-auto text-xs text-slate-500 hover:text-violet-400 border border-white/8 hover:border-violet-500/30 px-3 py-1 rounded-lg transition-all flex items-center gap-1"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                      Share
                    </button>
                  )}
                  {bet.result === 'pending' && (
                    <button onClick={() => deleteBet(bet.id)} className="ml-auto text-xs text-slate-600 hover:text-red-400 transition-colors p-1">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
