'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BET_TYPES, LEAGUES } from '@/lib/types'

interface OCRResult {
  match_name?: string
  league?: string
  bet_type?: string
  selection?: string
  odds?: number
  stake?: number
  match_date?: string
}

interface BetSlipFormProps {
  userId: string
  onBetAdded: () => void
  onBetAttempt?: () => boolean
  isAtPaywall?: boolean
  onShowPaywall?: () => void
}

const BOOKMAKERS = [
  'Bet365', 'William Hill', 'Betfair', 'Paddy Power', 'Ladbrokes',
  'Coral', 'Unibet', 'Sky Bet', 'Betway', 'BoyleSports',
  'Pinnacle', '888sport', 'Betfred', 'Other',
]

const QUICK_BET_TYPES = [
  { label: '1X2', value: 'Match Result (1X2)' },
  { label: 'O/U', value: 'Over / Under' },
  { label: 'BTTS', value: 'Both Teams to Score' },
  { label: 'ACCA', value: 'Accumulator' },
  { label: 'CS', value: 'Correct Score' },
  { label: 'HT', value: 'Half-Time Result' },
]

export default function BetSlipForm({ userId, onBetAdded, onBetAttempt, isAtPaywall, onShowPaywall }: BetSlipFormProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    match_name: '',
    league: '',
    bet_type: 'Match Result (1X2)',
    selection: '',
    odds: '',
    stake: '',
    bookmaker: '',
    match_date: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)

  const odds = parseFloat(form.odds) || 0
  const stake = parseFloat(form.stake) || 0
  const potentialReturn = odds > 1 && stake > 0 ? odds * stake : 0
  const potentialProfit = odds > 1 && stake > 0 ? (odds - 1) * stake : 0

  async function handlePhotoUpload(file: File) {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return }
    setOcrLoading(true)
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => setUploadedImage(e.target?.result as string)
    reader.readAsDataURL(file)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/upload-bet', { method: 'POST', body: formData })
      const data: OCRResult = await res.json()
      if (res.ok && data) {
        setForm(prev => ({
          ...prev,
          match_name: data.match_name || prev.match_name,
          league: data.league || prev.league,
          bet_type: data.bet_type || prev.bet_type,
          selection: data.selection || prev.selection,
          odds: data.odds ? String(data.odds) : prev.odds,
          stake: data.stake ? String(data.stake) : prev.stake,
          match_date: data.match_date || prev.match_date,
        }))
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError('Could not read bet slip — please fill in manually.')
      }
    } catch {
      setError('Photo upload failed. Please fill in manually.')
    }
    setOcrLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (onBetAttempt && !onBetAttempt()) return
    if (!form.match_name || !form.selection || !form.odds || !form.stake) {
      setError('Match, selection, odds and stake are required.')
      return
    }
    setLoading(true)
    setError('')
    const oddsNum = parseFloat(form.odds)
    const stakeNum = parseFloat(form.stake)
    const { error: dbError } = await supabase.from('bet_slips').insert({
      user_id: userId,
      match_name: form.match_name,
      league: form.league || null,
      bet_type: form.bet_type,
      selection: form.selection,
      odds: oddsNum,
      stake: stakeNum,
      bookmaker: form.bookmaker || null,
      potential_return: oddsNum * stakeNum,
      result: 'pending',
      profit_loss: 0,
      match_date: form.match_date || null,
      notes: form.notes || null,
    })
    if (dbError) {
      setError(dbError.message)
    } else {
      setForm({ match_name: '', league: '', bet_type: 'Match Result (1X2)', selection: '', odds: '', stake: '', bookmaker: '', match_date: '', notes: '' })
      setUploadedImage(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      onBetAdded()
    }
    setLoading(false)
  }

  const f = (v: string) => setForm(p => ({ ...p, ...JSON.parse(v) }))

  return (
    <div className="relative bg-[#0E1628] border border-white/[0.07] rounded-2xl overflow-hidden">
      {/* Paywall overlay */}
      {isAtPaywall && (
        <div
          className="absolute inset-0 z-10 rounded-2xl flex flex-col items-center justify-center cursor-pointer"
          style={{ background: 'rgba(6,9,20,0.9)', backdropFilter: 'blur(4px)' }}
          onClick={onShowPaywall}
        >
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-white font-bold text-sm mb-1">Free limit reached</p>
          <p className="text-slate-400 text-xs mb-4 text-center max-w-[200px]">Upgrade to Pro to continue logging bets</p>
          <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
            Upgrade to Pro →
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div>
          <h2 className="text-white font-bold text-sm">Add Bet Slip</h2>
          <p className="text-slate-500 text-xs">Upload a photo or enter manually</p>
        </div>
      </div>

      <div className="p-5">
        {/* Photo Upload Zone */}
        <div
          className={`relative border-2 border-dashed rounded-xl p-4 mb-5 text-center cursor-pointer transition-all ${
            dragOver ? 'border-blue-500/60 bg-blue-500/8' : 'border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handlePhotoUpload(f) }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} />
          {ocrLoading ? (
            <div className="flex items-center justify-center gap-2 py-1">
              <div className="w-4 h-4 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
              <span className="text-blue-400 text-sm font-medium">Reading bet slip with AI…</span>
            </div>
          ) : uploadedImage ? (
            <div className="flex items-center gap-3">
              <img src={uploadedImage} alt="Bet slip" className="w-12 h-12 rounded-lg object-cover border border-white/10" />
              <div className="text-left">
                <p className="text-emerald-400 text-sm font-bold">Bet slip scanned!</p>
                <p className="text-slate-500 text-xs">Form pre-filled. Review and submit.</p>
              </div>
              <button type="button" onClick={(e) => { e.stopPropagation(); setUploadedImage(null) }}
                className="ml-auto text-slate-600 hover:text-slate-400 text-xs">✕</button>
            </div>
          ) : (
            <div className="py-1">
              <svg className="w-6 h-6 text-slate-600 mx-auto mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-slate-400 text-sm">Drop a bet slip photo or <span className="text-blue-400 font-semibold">click to upload</span></p>
              <p className="text-slate-600 text-xs mt-0.5">AI reads and auto-fills the form</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Match name */}
          <div>
            <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Match *</label>
            <input
              type="text"
              placeholder="e.g. Arsenal vs Chelsea"
              value={form.match_name}
              onChange={e => setForm(p => ({ ...p, match_name: e.target.value }))}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
            />
          </div>

          {/* League + Bookmaker */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">League</label>
              <select
                value={form.league}
                onChange={e => setForm(p => ({ ...p, league: e.target.value }))}
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/40 transition-colors"
              >
                <option value="">Any league</option>
                {LEAGUES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Bookmaker</label>
              <select
                value={form.bookmaker}
                onChange={e => setForm(p => ({ ...p, bookmaker: e.target.value }))}
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/40 transition-colors"
              >
                <option value="">Select bookie</option>
                {BOOKMAKERS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {/* Bet type — quick buttons + full dropdown */}
          <div>
            <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Bet Type *</label>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {QUICK_BET_TYPES.map(qt => (
                <button
                  key={qt.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, bet_type: qt.value }))}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                    form.bet_type === qt.value
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : 'bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-slate-300 hover:border-white/[0.15]'
                  }`}
                >
                  {qt.label}
                </button>
              ))}
            </div>
            <select
              value={form.bet_type}
              onChange={e => setForm(p => ({ ...p, bet_type: e.target.value }))}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/40 transition-colors"
            >
              {BET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Selection */}
          <div>
            <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Your Selection *</label>
            <input
              type="text"
              placeholder="e.g. Arsenal Win, Over 2.5, BTTS Yes"
              value={form.selection}
              onChange={e => setForm(p => ({ ...p, selection: e.target.value }))}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
            />
          </div>

          {/* Odds + Stake side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Odds *</label>
              <input
                type="number" step="0.01" min="1"
                placeholder="2.50"
                value={form.odds}
                onChange={e => setForm(p => ({ ...p, odds: e.target.value }))}
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Stake (£) *</label>
              <input
                type="number" step="0.01" min="0"
                placeholder="10.00"
                value={form.stake}
                onChange={e => setForm(p => ({ ...p, stake: e.target.value }))}
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
              />
            </div>
          </div>

          {/* Date + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Match Date</label>
              <input
                type="date"
                value={form.match_date}
                onChange={e => setForm(p => ({ ...p, match_date: e.target.value }))}
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Notes</label>
              <input
                type="text"
                placeholder="Optional…"
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
              />
            </div>
          </div>

          {/* Live P&L Calculator */}
          {odds > 1 && stake > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
              <div className="grid grid-cols-3 divide-x divide-white/[0.07]">
                <div className="px-4 py-3 text-center">
                  <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Stake</p>
                  <p className="text-white font-bold">£{stake.toFixed(2)}</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Return</p>
                  <p className="text-white font-bold">£{potentialReturn.toFixed(2)}</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Profit</p>
                  <p className="text-emerald-400 font-black">+£{potentialProfit.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs font-medium">{error}</div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-xs font-medium flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              Bet slip saved!
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm"
          >
            {loading ? 'Saving…' : '+ Add Bet Slip'}
          </button>
        </form>
      </div>
    </div>
  )
}
