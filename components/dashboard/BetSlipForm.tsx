'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
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

interface UpcomingFixture {
  id: number
  date: string
  home_team: string
  home_logo: string
  away_team: string
  away_logo: string
  league: string
  league_flag: string
  odds: {
    home: number | null
    draw: number | null
    away: number | null
    over25: number | null
    btts: number | null
  } | null
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

function groupByDate(fixtures: UpcomingFixture[]) {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const groups: Record<string, UpcomingFixture[]> = {}
  for (const f of fixtures) {
    const d = f.date.split('T')[0]
    const label = d === today ? 'Today' : d === tomorrow ? 'Tomorrow' : new Date(f.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    if (!groups[label]) groups[label] = []
    groups[label].push(f)
  }
  return groups
}

export default function BetSlipForm({ userId, onBetAdded, onBetAttempt, isAtPaywall, onShowPaywall }: BetSlipFormProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

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

  // Game picker state
  const [showPicker, setShowPicker] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerFixtures, setPickerFixtures] = useState<UpcomingFixture[]>([])
  const [pickerSearch, setPickerSearch] = useState('')
  const [selectedFixture, setSelectedFixture] = useState<UpcomingFixture | null>(null)
  const [pickerFetched, setPickerFetched] = useState(false)

  const odds = parseFloat(form.odds) || 0
  const stake = parseFloat(form.stake) || 0
  const potentialReturn = odds > 1 && stake > 0 ? odds * stake : 0
  const potentialProfit = odds > 1 && stake > 0 ? (odds - 1) * stake : 0

  // Close picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    if (showPicker) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPicker])

  const fetchFixtures = useCallback(async () => {
    if (pickerFetched) return
    setPickerLoading(true)
    try {
      const res = await fetch('/api/fixtures/upcoming')
      const data = await res.json()
      if (data.success) setPickerFixtures(data.fixtures || [])
      setPickerFetched(true)
    } catch {}
    setPickerLoading(false)
  }, [pickerFetched])

  function openPicker() {
    setShowPicker(true)
    fetchFixtures()
  }

  function selectFixture(f: UpcomingFixture) {
    const matchDate = f.date.split('T')[0]
    setForm(prev => ({
      ...prev,
      match_name: `${f.home_team} vs ${f.away_team}`,
      league: f.league,
      match_date: matchDate,
    }))
    setSelectedFixture(f)
    setShowPicker(false)
    setPickerSearch('')
  }

  function applyOddsChip(value: number) {
    setForm(prev => ({ ...prev, odds: String(value) }))
  }

  // Filter fixtures by search
  const filteredFixtures = pickerSearch
    ? pickerFixtures.filter(f =>
        `${f.home_team} ${f.away_team} ${f.league}`.toLowerCase().includes(pickerSearch.toLowerCase())
      )
    : pickerFixtures

  const grouped = groupByDate(filteredFixtures)

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
      setSelectedFixture(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      onBetAdded()
    }
    setLoading(false)
  }

  // Odds chips for selected fixture mapped to current bet type
  const oddsChips = selectedFixture?.odds ? (() => {
    const o = selectedFixture.odds
    const chips = []
    if (o.home) chips.push({ label: `H ${o.home.toFixed(2)}`, value: o.home })
    if (o.draw) chips.push({ label: `D ${o.draw.toFixed(2)}`, value: o.draw })
    if (o.away) chips.push({ label: `A ${o.away.toFixed(2)}`, value: o.away })
    if (o.over25) chips.push({ label: `O2.5 ${o.over25.toFixed(2)}`, value: o.over25 })
    if (o.btts) chips.push({ label: `BTTS ${o.btts.toFixed(2)}`, value: o.btts })
    return chips
  })() : []

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
          <p className="text-slate-500 text-xs">Pick a game or upload a photo</p>
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

          {/* ── GAME PICKER ─────────────────────────────────────────────── */}
          <div ref={pickerRef} className="relative">
            <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Match *</label>

            {/* Combined input + pick button */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Arsenal vs Chelsea"
                value={form.match_name}
                onChange={e => {
                  setForm(p => ({ ...p, match_name: e.target.value }))
                  if (selectedFixture) setSelectedFixture(null)
                }}
                className="flex-1 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
              />
              <button
                type="button"
                onClick={openPicker}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap ${
                  showPicker
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                    : 'bg-white/[0.04] border-white/[0.1] text-slate-400 hover:text-white hover:border-white/[0.2]'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Pick game
              </button>
            </div>

            {/* Dropdown panel */}
            {showPicker && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0a1120] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden"
                style={{ maxHeight: '340px', display: 'flex', flexDirection: 'column' }}>

                {/* Search */}
                <div className="p-3 border-b border-white/[0.07] shrink-0">
                  <div className="relative">
                    <svg className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search team or league…"
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/40"
                    />
                  </div>
                </div>

                {/* Fixture list */}
                <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
                  {pickerLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8">
                      <div className="w-4 h-4 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
                      <span className="text-slate-500 text-sm">Loading fixtures…</span>
                    </div>
                  ) : filteredFixtures.length === 0 ? (
                    <div className="py-8 text-center text-slate-600 text-sm">No matches found</div>
                  ) : (
                    Object.entries(grouped).map(([dateLabel, fixtures]) => (
                      <div key={dateLabel}>
                        <div className="px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.05]">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{dateLabel}</span>
                        </div>
                        {fixtures.map(f => {
                          const kickoff = new Date(f.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => selectFixture(f)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left border-b border-white/[0.04] last:border-0"
                            >
                              {/* Kickoff time */}
                              <span className="text-slate-500 text-[11px] font-mono w-10 shrink-0">{kickoff}</span>

                              {/* Teams */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {f.home_logo && <img src={f.home_logo} alt="" className="w-4 h-4 object-contain shrink-0" />}
                                  <span className="text-white text-xs font-semibold truncate">{f.home_team}</span>
                                  <span className="text-slate-600 text-[10px] shrink-0">vs</span>
                                  {f.away_logo && <img src={f.away_logo} alt="" className="w-4 h-4 object-contain shrink-0" />}
                                  <span className="text-white text-xs font-semibold truncate">{f.away_team}</span>
                                </div>
                                <p className="text-slate-600 text-[10px] mt-0.5">{f.league_flag} {f.league}</p>
                              </div>

                              {/* Odds preview if available */}
                              {f.odds?.home && (
                                <div className="shrink-0 flex gap-1">
                                  <span className="text-[10px] text-slate-500 bg-white/[0.04] rounded px-1.5 py-0.5">{f.odds.home.toFixed(2)}</span>
                                  {f.odds.draw && <span className="text-[10px] text-slate-500 bg-white/[0.04] rounded px-1.5 py-0.5">{f.odds.draw.toFixed(2)}</span>}
                                  <span className="text-[10px] text-slate-500 bg-white/[0.04] rounded px-1.5 py-0.5">{f.odds.away?.toFixed(2)}</span>
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {/* ── END GAME PICKER ─────────────────────────────────────────── */}

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

          {/* Odds + Stake */}
          <div>
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

            {/* Bet365 odds chips — only shown when a game is selected and has odds */}
            {oddsChips.length > 0 && (
              <div className="mt-2">
                <p className="text-slate-600 text-[10px] mb-1.5">Bet365 odds — tap to use:</p>
                <div className="flex gap-1.5 flex-wrap">
                  {oddsChips.map(chip => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => applyOddsChip(chip.value)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition-all ${
                        parseFloat(form.odds) === chip.value
                          ? 'bg-blue-500/25 border-blue-500/50 text-blue-200'
                          : 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:border-blue-500/30 hover:text-blue-300'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
