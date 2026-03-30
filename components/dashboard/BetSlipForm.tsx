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
  onBetAttempt?: () => boolean  // returns false to block submission
  isAtPaywall?: boolean
  onShowPaywall?: () => void
}

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
  const potentialReturn = odds > 0 && stake > 0 ? (odds * stake).toFixed(2) : '—'
  const potentialProfit = odds > 0 && stake > 0 ? ((odds - 1) * stake).toFixed(2) : '—'

  async function handlePhotoUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }
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
        setError('Could not read bet slip. Please fill in manually.')
      }
    } catch {
      setError('Photo upload failed. Please fill in manually.')
    }
    setOcrLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Check paywall before anything else
    if (onBetAttempt && !onBetAttempt()) return
    if (!form.match_name || !form.selection || !form.odds || !form.stake) {
      setError('Please fill in match, selection, odds and stake.')
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
      potential_return: oddsNum * stakeNum,
      result: 'pending',
      profit_loss: 0,
      match_date: form.match_date || null,
      notes: form.notes || null,
    })
    if (dbError) {
      setError(dbError.message)
    } else {
      setForm({ match_name: '', league: '', bet_type: 'Match Result (1X2)', selection: '', odds: '', stake: '', match_date: '', notes: '' })
      setUploadedImage(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      onBetAdded()
    }
    setLoading(false)
  }

  return (
    <div className="relative bg-[#13131F] border border-white/5 rounded-2xl p-6">
      {/* Paywall overlay on form */}
      {isAtPaywall && (
        <div
          className="absolute inset-0 z-10 rounded-2xl flex flex-col items-center justify-center cursor-pointer"
          style={{ background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={onShowPaywall}
        >
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-white font-bold text-sm mb-1">Free limit reached</p>
          <p className="text-slate-400 text-xs mb-4 text-center max-w-[200px]">Upgrade to Pro to continue logging bets</p>
          <button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl">
            Upgrade to Pro →
          </button>
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </div>
        <div>
          <h2 className="text-white font-semibold">Add Bet Slip</h2>
          <p className="text-slate-500 text-xs">Upload a photo or enter manually</p>
        </div>
      </div>

      {/* Photo Upload Zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-4 mb-5 text-center cursor-pointer transition-all ${
          dragOver ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/2'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handlePhotoUpload(f) }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} />
        {ocrLoading ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-violet-400 text-sm">Reading bet slip with AI...</span>
          </div>
        ) : uploadedImage ? (
          <div className="flex items-center gap-3">
            <img src={uploadedImage} alt="Bet slip" className="w-12 h-12 rounded-lg object-cover" />
            <div className="text-left">
              <p className="text-emerald-400 text-sm font-medium">✓ Bet slip scanned!</p>
              <p className="text-slate-500 text-xs">Form pre-filled. Review and submit.</p>
            </div>
          </div>
        ) : (
          <div className="py-1">
            <svg className="w-7 h-7 text-slate-500 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <p className="text-slate-400 text-sm">Drop a bet slip photo or <span className="text-violet-400">click to upload</span></p>
            <p className="text-slate-600 text-xs mt-1">AI will auto-fill the form</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-slate-400 text-xs font-medium block mb-1.5">Match *</label>
            <input
              type="text"
              placeholder="e.g. Arsenal vs Chelsea"
              value={form.match_name}
              onChange={e => setForm(p => ({ ...p, match_name: e.target.value }))}
              className="w-full bg-[#0B0B14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1.5">League</label>
            <select
              value={form.league}
              onChange={e => setForm(p => ({ ...p, league: e.target.value }))}
              className="w-full bg-[#0B0B14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
            >
              <option value="">Select league...</option>
              {LEAGUES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1.5">Bet Type *</label>
            <select
              value={form.bet_type}
              onChange={e => setForm(p => ({ ...p, bet_type: e.target.value }))}
              className="w-full bg-[#0B0B14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
            >
              {BET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-slate-400 text-xs font-medium block mb-1.5">Your Selection *</label>
            <input
              type="text"
              placeholder="e.g. Arsenal to Win, Over 2.5, BTTS Yes"
              value={form.selection}
              onChange={e => setForm(p => ({ ...p, selection: e.target.value }))}
              className="w-full bg-[#0B0B14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1.5">Odds *</label>
            <input
              type="number"
              step="0.01"
              min="1"
              placeholder="e.g. 2.50"
              value={form.odds}
              onChange={e => setForm(p => ({ ...p, odds: e.target.value }))}
              className="w-full bg-[#0B0B14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1.5">Stake *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 10.00"
              value={form.stake}
              onChange={e => setForm(p => ({ ...p, stake: e.target.value }))}
              className="w-full bg-[#0B0B14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1.5">Match Date</label>
            <input
              type="date"
              value={form.match_date}
              onChange={e => setForm(p => ({ ...p, match_date: e.target.value }))}
              className="w-full bg-[#0B0B14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1.5">Notes</label>
            <input
              type="text"
              placeholder="Optional notes..."
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full bg-[#0B0B14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
        </div>

        {/* P&L Preview */}
        {odds > 1 && stake > 0 && (
          <div className="bg-[#0B0B14] rounded-xl p-3 flex justify-between items-center border border-white/5">
            <div className="text-center">
              <div className="text-slate-500 text-xs">Stake</div>
              <div className="text-white font-semibold">{stake.toFixed(2)}</div>
            </div>
            <div className="text-slate-600">→</div>
            <div className="text-center">
              <div className="text-slate-500 text-xs">Potential Return</div>
              <div className="text-emerald-400 font-semibold">{potentialReturn}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-500 text-xs">Potential Profit</div>
              <div className="text-emerald-400 font-bold">+{potentialProfit}</div>
            </div>
          </div>
        )}

        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{error}</div>}
        {success && <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm">✓ Bet slip saved!</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-violet-500/20"
        >
          {loading ? 'Saving...' : '+ Add Bet Slip'}
        </button>
      </form>
    </div>
  )
}
