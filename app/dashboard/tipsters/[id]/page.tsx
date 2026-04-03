'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
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

interface Tipster {
  id: string
  display_name: string
  bio: string
  speciality: string
  monthly_price: number
  total_tips: number
  wins: number
  losses: number
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

export default function TipsterProfilePage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const justSubscribed = searchParams.get('subscribed') === 'true'

  const [tipster, setTipster] = useState<Tipster | null>(null)
  const [tips, setTips] = useState<Tip[]>([])
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isTipster, setIsTipster] = useState(false)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    fetch(`/api/tipsters/${id}`)
      .then(r => r.json())
      .then(d => {
        setTipster(d.tipster)
        setTips(d.tips || [])
        setIsSubscribed(d.isSubscribed || justSubscribed)
        setIsTipster(d.isTipster)
      })
      .finally(() => setLoading(false))
  }, [id, justSubscribed])

  async function handleSubscribe() {
    setSubscribing(true)
    const res = await fetch('/api/stripe/tipster-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipster_id: id }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else alert(data.error || 'Failed to start checkout')
    setSubscribing(false)
  }

  if (loading) return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-white/5 rounded-2xl h-48 animate-pulse mb-4" />
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="bg-white/5 rounded-2xl h-24 animate-pulse" />)}
      </div>
    </div>
  )

  if (!tipster) return (
    <div className="p-8 text-center text-white/40">Tipster not found.</div>
  )

  const lockedTips = !isSubscribed && !isTipster ? tips.filter(t => !t.is_free).length : 0

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Success banner */}
      {justSubscribed && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
          <span>🎉</span>
          <p className="text-emerald-300 font-semibold text-sm">You're now subscribed to {tipster.display_name}! All tips are now unlocked.</p>
        </div>
      )}

      {/* Profile header */}
      <div className="bg-[#13162b] border border-white/8 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-violet-500/20">
              {tipster.display_name[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{tipster.display_name}</h1>
              {tipster.speciality && <p className="text-violet-300 text-sm">{tipster.speciality}</p>}
              {tipster.bio && <p className="text-white/40 text-sm mt-1 max-w-lg">{tipster.bio}</p>}
            </div>
          </div>

          {/* Subscribe / manage button */}
          {!isTipster && (
            <div className="flex flex-col items-end gap-2">
              {isSubscribed ? (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-xl">
                  <span className="text-emerald-400 text-sm font-semibold">✅ Subscribed</span>
                </div>
              ) : (
                <button
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
                >
                  {subscribing ? 'Loading…' : `Subscribe — £${tipster.monthly_price}/mo`}
                </button>
              )}
              <p className="text-white/25 text-xs">Cancel anytime</p>
            </div>
          )}
          {isTipster && (
            <Link href="/dashboard/my-tipster" className="bg-white/10 hover:bg-white/15 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
              ⚙️ Manage Tips
            </Link>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          {[
            { label: 'ROI', value: `${tipster.roi >= 0 ? '+' : ''}${tipster.roi}%`, highlight: tipster.roi > 0 },
            { label: 'Win Rate', value: `${tipster.win_rate}%`, highlight: tipster.win_rate >= 50 },
            { label: 'Total Tips', value: String(tipster.total_tips) },
            { label: 'Avg Odds', value: tipster.avg_odds > 0 ? tipster.avg_odds.toFixed(2) : '—' },
            { label: 'Subscribers', value: String(tipster.subscribers) },
          ].map(stat => (
            <div key={stat.label} className="bg-white/5 rounded-xl p-3 text-center">
              <p className={`text-lg font-bold ${stat.highlight ? 'text-emerald-400' : 'text-white'}`}>{stat.value}</p>
              <p className="text-white/30 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* W/L bar */}
        {tipster.total_tips > 0 && (
          <div className="mt-4">
            <div className="flex gap-1 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 rounded-full transition-all" style={{ width: `${tipster.win_rate}%` }} />
              <div className="bg-red-500/60 rounded-full flex-1" />
            </div>
            <div className="flex justify-between text-xs text-white/30 mt-1">
              <span>{tipster.wins}W</span>
              <span>{tipster.losses}L</span>
            </div>
          </div>
        )}
      </div>

      {/* Tips feed */}
      <div>
        <h2 className="text-white font-bold mb-4 text-lg">
          Tips {isSubscribed || isTipster ? `(${tips.length})` : `· ${tips.filter(t => t.is_free).length} free`}
        </h2>

        {tips.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-white/40">No tips posted yet.</p>
          </div>
        )}

        <div className="space-y-3">
          {tips.filter(t => t.is_free || isSubscribed || isTipster).map(tip => {
            const kickOff = tip.kick_off ? new Date(tip.kick_off).toLocaleDateString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            }) : null

            return (
              <div key={tip.id} className={`border rounded-2xl p-4 ${
                tip.result === 'win' ? 'bg-emerald-950/30 border-emerald-500/20' :
                tip.result === 'loss' ? 'bg-red-950/20 border-red-500/15' :
                'bg-[#13162b] border-white/8'
              }`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-white font-bold text-sm">{tip.match_name}</p>
                    {tip.league && <p className="text-white/30 text-xs">{tip.league}{kickOff ? ` · ${kickOff}` : ''}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!tip.is_free && <span className="text-[10px] text-amber-400 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Premium</span>}
                    <ResultBadge result={tip.result} />
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="bg-violet-600/20 text-violet-300 text-xs font-semibold px-2.5 py-1 rounded-lg border border-violet-500/20">
                    {tip.bet_type}
                  </span>
                  <span className="text-white font-bold text-sm">@ {tip.odds.toFixed(2)}</span>
                  <span className="text-white/40 text-xs">{tip.stake_units}u stake</span>
                  {tip.profit_loss !== null && tip.result !== null && (
                    <span className={`text-sm font-bold ml-auto ${tip.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tip.profit_loss >= 0 ? '+' : ''}{tip.profit_loss}u
                    </span>
                  )}
                </div>

                {tip.reasoning && (
                  <p className="text-white/40 text-xs mt-2 leading-relaxed">{tip.reasoning}</p>
                )}
              </div>
            )
          })}

          {/* Locked premium tips */}
          {lockedTips > 0 && (
            <div className="relative">
              <div className="bg-[#13162b] border border-white/8 rounded-2xl p-6 filter blur-[2px]">
                <p className="text-white/20 text-sm">Premium tip locked...</p>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0B14]/80 rounded-2xl border border-amber-500/30">
                <p className="text-xl mb-1">🔒</p>
                <p className="text-white font-bold text-sm mb-1">{lockedTips} premium tip{lockedTips > 1 ? 's' : ''} locked</p>
                <p className="text-white/40 text-xs mb-3">Subscribe to unlock all picks</p>
                <button
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-2 rounded-xl text-sm transition-colors"
                >
                  {subscribing ? 'Loading…' : `Unlock — £${tipster.monthly_price}/mo`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
