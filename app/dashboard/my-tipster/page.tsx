'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Tip {
  id: string
  match_name: string
  league: string
  kick_off: string
  bet_type: string
  odds: number
  stake_units: number
  reasoning: string
  result: 'win' | 'loss' | 'void' | null
  profit_loss: number
  is_free: boolean
  created_at: string
}

interface TipsterProfile {
  id: string
  display_name: string
  bio: string
  speciality: string
  monthly_price: number
  total_tips: number
  wins: number
  losses: number
  voids: number
  win_rate: number
  roi: number
  total_profit: number
  avg_odds: number
  subscribers: number
}

function ResultBadge({ result }: { result: string | null }) {
  if (!result) return <span className="text-xs text-white/30 px-2 py-0.5 rounded-full bg-white/5">Pending</span>
  const styles: Record<string, string> = {
    win: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    loss: 'bg-red-500/15 text-red-400 border border-red-500/20',
    void: 'bg-white/10 text-white/40 border border-white/10',
  }
  const labels: Record<string, string> = { win: '✅ Won', loss: '❌ Lost', void: '↩️ Void' }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[result]}`}>{labels[result]}</span>
}

export default function MyTipsterPage() {
  const router = useRouter()
  const [tipster, setTipster] = useState<TipsterProfile | null>(null)
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)
  const [notTipster, setNotTipster] = useState(false)

  // New tip form
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({
    match_name: '',
    league: '',
    kick_off: '',
    bet_type: '',
    odds: '',
    stake_units: '1',
    reasoning: '',
    is_free: false,
  })

  // Result update
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/tipsters/me')
      .then(r => r.json())
      .then(d => {
        if (d.error === 'Not a tipster') { setNotTipster(true); return }
        setTipster(d.tipster)
        setTips(d.tips || [])
      })
      .finally(() => setLoading(false))
  }, [])

  async function handlePostTip(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')
    const res = await fetch(`/api/tipsters/${tipster!.id}/tips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        odds: parseFloat(form.odds),
        stake_units: parseFloat(form.stake_units),
      }),
    })
    const data = await res.json()
    if (data.error) { setFormError(data.error); setSubmitting(false); return }
    setTips(prev => [data.tip, ...prev])
    setShowForm(false)
    setForm({ match_name: '', league: '', kick_off: '', bet_type: '', odds: '', stake_units: '1', reasoning: '', is_free: false })
    setSubmitting(false)
    // Refresh stats
    fetch('/api/tipsters/me').then(r => r.json()).then(d => { if (d.tipster) setTipster(d.tipster) })
  }

  async function handleSetResult(tipId: string, result: 'win' | 'loss' | 'void') {
    setUpdatingId(tipId)
    const res = await fetch(`/api/tipsters/tips/${tipId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result }),
    })
    const data = await res.json()
    if (data.tip) {
      setTips(prev => prev.map(t => t.id === tipId ? data.tip : t))
      // Refresh stats
      fetch('/api/tipsters/me').then(r => r.json()).then(d => { if (d.tipster) setTipster(d.tipster) })
    }
    setUpdatingId(null)
  }

  if (loading) return (
    <div className="p-8 max-w-4xl mx-auto space-y-4">
      <div className="bg-white/5 rounded-2xl h-32 animate-pulse" />
      <div className="bg-white/5 rounded-2xl h-48 animate-pulse" />
    </div>
  )

  if (notTipster) return (
    <div className="p-8 max-w-2xl mx-auto text-center">
      <div className="bg-[#13162b] border border-white/10 rounded-2xl p-12">
        <p className="text-5xl mb-4">🏆</p>
        <h1 className="text-2xl font-bold text-white mb-2">You're not a tipster yet</h1>
        <p className="text-white/40 text-sm mb-6">Register as a tipster to start posting picks and earning from subscribers.</p>
        <Link
          href="/dashboard/become-tipster"
          className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-3 rounded-xl text-sm transition-colors inline-block"
        >
          🚀 Become a Tipster
        </Link>
      </div>
    </div>
  )

  if (!tipster) return <div className="p-8 text-white/40 text-center">Something went wrong.</div>

  const pendingTips = tips.filter(t => t.result === null)
  const settledTips = tips.filter(t => t.result !== null)
  const monthlyRevenue = (tipster.monthly_price * 0.8 * tipster.subscribers).toFixed(2)

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xl">📢</div>
          <div>
            <h1 className="text-2xl font-bold text-white">{tipster.display_name}</h1>
            <p className="text-white/40 text-sm">Your tipster dashboard</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/tipsters/${tipster.id}`}
            className="bg-white/10 hover:bg-white/15 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            👁️ View Profile
          </Link>
          <button
            onClick={() => setShowForm(true)}
            className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            + Post Tip
          </button>
        </div>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Subscribers', value: String(tipster.subscribers), icon: '👥', highlight: false },
          { label: 'Monthly Revenue', value: `£${monthlyRevenue}`, icon: '💰', highlight: true },
          { label: 'ROI', value: `${tipster.roi >= 0 ? '+' : ''}${tipster.roi}%`, icon: '📈', highlight: tipster.roi > 0 },
          { label: 'Win Rate', value: `${tipster.win_rate}%`, icon: '🎯', highlight: tipster.win_rate >= 50 },
        ].map(stat => (
          <div key={stat.label} className="bg-[#13162b] border border-white/8 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{stat.icon}</span>
              <p className="text-white/40 text-xs">{stat.label}</p>
            </div>
            <p className={`text-xl font-bold ${stat.highlight ? 'text-emerald-400' : 'text-white'}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Record summary */}
      <div className="bg-[#13162b] border border-white/8 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/60 text-sm font-semibold">All-time Record</p>
          <p className="text-white/30 text-xs">{tipster.total_tips} tips total</p>
        </div>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-emerald-400 text-lg font-bold">{tipster.wins}</p>
            <p className="text-white/30 text-xs">Wins</p>
          </div>
          <div>
            <p className="text-red-400 text-lg font-bold">{tipster.losses}</p>
            <p className="text-white/30 text-xs">Losses</p>
          </div>
          <div>
            <p className="text-white/50 text-lg font-bold">{tipster.voids}</p>
            <p className="text-white/30 text-xs">Voids</p>
          </div>
          <div>
            <p className={`text-lg font-bold ${tipster.total_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {tipster.total_profit >= 0 ? '+' : ''}{tipster.total_profit}u
            </p>
            <p className="text-white/30 text-xs">Profit</p>
          </div>
        </div>
        {tipster.total_tips > 0 && (
          <div className="mt-4">
            <div className="flex gap-1 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 rounded-full" style={{ width: `${tipster.win_rate}%` }} />
              <div className="bg-red-500/60 rounded-full flex-1" />
            </div>
          </div>
        )}
      </div>

      {/* Pending tips — needs result */}
      {pendingTips.length > 0 && (
        <div className="mb-6">
          <h2 className="text-white font-bold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block"></span>
            Awaiting Result ({pendingTips.length})
          </h2>
          <div className="space-y-3">
            {pendingTips.map(tip => (
              <div key={tip.id} className="bg-[#13162b] border border-amber-500/20 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-white font-bold text-sm">{tip.match_name}</p>
                    <p className="text-white/30 text-xs">{tip.league}{tip.kick_off ? ` · ${new Date(tip.kick_off).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!tip.is_free && <span className="text-[10px] text-amber-400 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Premium</span>}
                    <ResultBadge result={tip.result} />
                  </div>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-violet-600/20 text-violet-300 text-xs font-semibold px-2.5 py-1 rounded-lg border border-violet-500/20">{tip.bet_type}</span>
                  <span className="text-white font-bold text-sm">@ {tip.odds.toFixed(2)}</span>
                  <span className="text-white/40 text-xs">{tip.stake_units}u stake</span>
                </div>
                {/* Result buttons */}
                <div className="flex gap-2">
                  <p className="text-white/30 text-xs self-center mr-1">Set result:</p>
                  {(['win', 'loss', 'void'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => handleSetResult(tip.id, r)}
                      disabled={updatingId === tip.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                        r === 'win' ? 'bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30' :
                        r === 'loss' ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20' :
                        'bg-white/10 hover:bg-white/15 text-white/50 border border-white/15'
                      }`}
                    >
                      {updatingId === tip.id ? '…' : r === 'win' ? '✅ Win' : r === 'loss' ? '❌ Loss' : '↩️ Void'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settled tips history */}
      <div>
        <h2 className="text-white font-bold mb-3">Tip History ({settledTips.length})</h2>
        {settledTips.length === 0 && tips.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-white font-bold mb-1">No tips yet</p>
            <p className="text-white/40 text-sm mb-4">Post your first tip to start building your record</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              + Post First Tip
            </button>
          </div>
        )}
        <div className="space-y-3">
          {settledTips.map(tip => {
            const kickOff = tip.kick_off ? new Date(tip.kick_off).toLocaleDateString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'short'
            }) : null
            return (
              <div key={tip.id} className={`border rounded-2xl p-4 ${
                tip.result === 'win' ? 'bg-emerald-950/30 border-emerald-500/20' :
                tip.result === 'loss' ? 'bg-red-950/20 border-red-500/15' :
                'bg-[#13162b] border-white/8'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-white font-bold text-sm">{tip.match_name}</p>
                    <p className="text-white/30 text-xs">{tip.league}{kickOff ? ` · ${kickOff}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!tip.is_free && <span className="text-[10px] text-amber-400 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Premium</span>}
                    <ResultBadge result={tip.result} />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="bg-violet-600/20 text-violet-300 text-xs font-semibold px-2.5 py-1 rounded-lg border border-violet-500/20">{tip.bet_type}</span>
                  <span className="text-white font-bold text-sm">@ {tip.odds.toFixed(2)}</span>
                  <span className="text-white/40 text-xs">{tip.stake_units}u</span>
                  {tip.profit_loss !== null && (
                    <span className={`text-sm font-bold ml-auto ${tip.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tip.profit_loss >= 0 ? '+' : ''}{tip.profit_loss}u
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Post Tip Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-4">
          <div className="bg-[#0F1126] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Post a New Tip</h2>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>
            <form onSubmit={handlePostTip} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Match *</label>
                  <input
                    value={form.match_name}
                    onChange={e => setForm(p => ({ ...p, match_name: e.target.value }))}
                    placeholder="e.g. Arsenal vs Chelsea"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-violet-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">League</label>
                  <input
                    value={form.league}
                    onChange={e => setForm(p => ({ ...p, league: e.target.value }))}
                    placeholder="e.g. Premier League"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-violet-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Kick-off</label>
                  <input
                    type="datetime-local"
                    value={form.kick_off}
                    onChange={e => setForm(p => ({ ...p, kick_off: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Bet Type *</label>
                  <input
                    value={form.bet_type}
                    onChange={e => setForm(p => ({ ...p, bet_type: e.target.value }))}
                    placeholder="e.g. Over 2.5 Goals, BTTS, Arsenal Win"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-violet-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Odds *</label>
                  <input
                    type="number"
                    value={form.odds}
                    onChange={e => setForm(p => ({ ...p, odds: e.target.value }))}
                    placeholder="e.g. 1.90"
                    min="1.01" step="0.01"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-violet-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Stake (units)</label>
                  <input
                    type="number"
                    value={form.stake_units}
                    onChange={e => setForm(p => ({ ...p, stake_units: e.target.value }))}
                    min="0.5" max="10" step="0.5"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Reasoning (optional)</label>
                  <textarea
                    value={form.reasoning}
                    onChange={e => setForm(p => ({ ...p, reasoning: e.target.value }))}
                    placeholder="Why you like this bet..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-violet-500 text-sm resize-none"
                  />
                </div>
              </div>

              {/* Free / Premium toggle */}
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white text-sm font-semibold">Free tip (teaser)</p>
                  <p className="text-white/30 text-xs">Visible to everyone, even non-subscribers</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, is_free: !p.is_free }))}
                  className={`w-11 h-6 rounded-full transition-colors relative ${form.is_free ? 'bg-violet-600' : 'bg-white/20'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow ${form.is_free ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>

              {formError && <p className="text-red-400 text-sm">{formError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                {submitting ? 'Posting…' : '📤 Post Tip'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
