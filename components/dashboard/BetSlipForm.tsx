'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LEAGUES } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface UpcomingFixture {
  id: number
  date: string
  home_team: string
  home_logo: string
  away_team: string
  away_logo: string
  league: string
  league_flag: string
  odds: { home: number | null; draw: number | null; away: number | null; over25: number | null; btts: number | null } | null
}

interface Market {
  category: string
  name: string
  selections: { label: string; odds: number }[]
}

interface AccaLeg {
  fixture_id: number
  match_name: string
  league: string
  selection: string
  bet_type: string
  odds: number
  match_date: string
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
  'Pinnacle', '888sport', 'Betfred', 'Bwin', 'Other',
]

const CATEGORY_ORDER = [
  'Match Result', 'Goals Over/Under', 'Both Teams Score', 'Half Time',
  'Half Time Goals', 'Corners', 'Cards', 'Correct Score',
  'Goalscorers', 'Handicap', 'First Goal', 'Totals', 'Other',
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

// ─── Main Component ────────────────────────────────────────────────────────────
export default function BetSlipForm({ userId, onBetAdded, onBetAttempt, isAtPaywall, onShowPaywall }: BetSlipFormProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Mode
  const [mode, setMode] = useState<'single' | 'acca'>('single')

  // Single bet form
  const [form, setForm] = useState({
    match_name: '', league: '', bet_type: 'Match Result (1X2)',
    selection: '', odds: '', stake: '', bookmaker: '', match_date: '', notes: '',
  })

  // Fixture picker
  const [showPicker, setShowPicker] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerFixtures, setPickerFixtures] = useState<UpcomingFixture[]>([])
  const [pickerSearch, setPickerSearch] = useState('')
  const [selectedFixture, setSelectedFixture] = useState<UpcomingFixture | null>(null)
  const [pickerFetched, setPickerFetched] = useState(false)

  // Markets
  const [markets, setMarkets] = useState<Market[]>([])
  const [marketsLoading, setMarketsLoading] = useState(false)
  const [marketSearch, setMarketSearch] = useState('')
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['Match Result', 'Goals Over/Under', 'Both Teams Score']))
  const [selectedSelection, setSelectedSelection] = useState<{ market: string; label: string; odds: number } | null>(null)

  // ACCA
  const [accaLegs, setAccaLegs] = useState<AccaLeg[]>([])
  const [accaFixture, setAccaFixture] = useState<UpcomingFixture | null>(null)
  const [accaBookmaker, setAccaBookmaker] = useState('')
  const [accaMarkets, setAccaMarkets] = useState<Market[]>([])
  const [accaMarketsLoading, setAccaMarketsLoading] = useState(false)
  const [accaStake, setAccaStake] = useState('')
  const [showAccaPicker, setShowAccaPicker] = useState(false)
  const [accaPickerSearch, setAccaPickerSearch] = useState('')
  const accaPickerRef = useRef<HTMLDivElement>(null)

  // Submit state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const odds = parseFloat(form.odds) || 0
  const stake = parseFloat(form.stake) || 0
  const potentialReturn = odds > 1 && stake > 0 ? odds * stake : 0
  const potentialProfit = odds > 1 && stake > 0 ? (odds - 1) * stake : 0

  const accaCombinedOdds = accaLegs.reduce((acc, l) => acc * l.odds, 1)
  const accaStakeNum = parseFloat(accaStake) || 0
  const accaReturn = accaStakeNum > 0 ? accaCombinedOdds * accaStakeNum : 0
  const accaProfit = accaStakeNum > 0 ? (accaCombinedOdds - 1) * accaStakeNum : 0

  // ── Fixture picker outside-click close ──
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false)
    }
    if (showPicker) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPicker])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (accaPickerRef.current && !accaPickerRef.current.contains(e.target as Node)) setShowAccaPicker(false)
    }
    if (showAccaPicker) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAccaPicker])

  // ── Fetch fixtures ──
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

  function openPicker() { setShowPicker(true); fetchFixtures() }

  function selectFixture(f: UpcomingFixture) {
    setForm(prev => ({ ...prev, match_name: `${f.home_team} vs ${f.away_team}`, league: f.league, match_date: f.date.split('T')[0] }))
    setSelectedFixture(f)
    setSelectedSelection(null)
    setMarkets([])
    setForm(prev => ({ ...prev, selection: '', odds: '' }))
    setShowPicker(false)
    setPickerSearch('')
  }

  // ── Fetch markets when fixture + bookmaker both set ──
  useEffect(() => {
    if (!selectedFixture || !form.bookmaker) { setMarkets([]); return }
    setMarketsLoading(true)
    setSelectedSelection(null)
    setForm(prev => ({ ...prev, selection: '', odds: '' }))
    fetch(`/api/fixtures/bookmaker-odds?fixtureId=${selectedFixture.id}&bookmaker=${encodeURIComponent(form.bookmaker)}`)
      .then(r => r.json())
      .then(data => { setMarkets(data.markets || []) })
      .catch(() => setMarkets([]))
      .finally(() => setMarketsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFixture?.id, form.bookmaker])

  // ── Fetch ACCA markets when acca fixture + bookmaker set ──
  useEffect(() => {
    if (!accaFixture || !accaBookmaker) { setAccaMarkets([]); return }
    setAccaMarketsLoading(true)
    fetch(`/api/fixtures/bookmaker-odds?fixtureId=${accaFixture.id}&bookmaker=${encodeURIComponent(accaBookmaker)}`)
      .then(r => r.json())
      .then(data => { setAccaMarkets(data.markets || []) })
      .catch(() => setAccaMarkets([]))
      .finally(() => setAccaMarketsLoading(false))
  }, [accaFixture?.id, accaBookmaker])

  function applySelection(marketName: string, label: string, odds: number) {
    setSelectedSelection({ market: marketName, label, odds })
    setForm(prev => ({ ...prev, bet_type: marketName, selection: label, odds: String(odds) }))
  }

  function addAccaLeg(marketName: string, label: string, legOdds: number) {
    if (!accaFixture) return
    const leg: AccaLeg = {
      fixture_id: accaFixture.id,
      match_name: `${accaFixture.home_team} vs ${accaFixture.away_team}`,
      league: accaFixture.league,
      selection: label,
      bet_type: marketName,
      odds: legOdds,
      match_date: accaFixture.date.split('T')[0],
    }
    setAccaLegs(prev => {
      const filtered = prev.filter(l => l.fixture_id !== accaFixture.id)
      return [...filtered, leg]
    })
    setAccaFixture(null)
    setAccaMarkets([])
  }

  function removeAccaLeg(i: number) {
    setAccaLegs(prev => prev.filter((_, idx) => idx !== i))
  }

  // ── Filter + sort markets ──
  const filteredMarkets = markets.filter(m =>
    !marketSearch || m.name.toLowerCase().includes(marketSearch.toLowerCase()) ||
    m.selections.some(s => s.label.toLowerCase().includes(marketSearch.toLowerCase()))
  )
  const grouped = CATEGORY_ORDER.reduce<Record<string, Market[]>>((acc, cat) => {
    const ms = filteredMarkets.filter(m => m.category === cat)
    if (ms.length) acc[cat] = ms
    return acc
  }, {})

  function toggleCategory(cat: string) {
    setOpenCategories(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  // ── Photo upload / OCR ──
  async function handlePhotoUpload(file: File) {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return }
    setOcrLoading(true); setError('')
    const reader = new FileReader()
    reader.onload = e => setUploadedImage(e.target?.result as string)
    reader.readAsDataURL(file)
    try {
      const fd = new FormData(); fd.append('image', file)
      const res = await fetch('/api/upload-bet', { method: 'POST', body: fd })
      const data = await res.json()
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
        setSuccess(true); setTimeout(() => setSuccess(false), 3000)
      } else { setError('Could not read bet slip — please fill in manually.') }
    } catch { setError('Photo upload failed. Please fill in manually.') }
    setOcrLoading(false)
  }

  // ── Submit single ──
  async function handleSubmitSingle(e: React.FormEvent) {
    e.preventDefault()
    if (onBetAttempt && !onBetAttempt()) return
    if (!form.match_name || !form.selection || !form.odds || !form.stake) {
      setError('Match, selection, odds and stake are required.'); return
    }
    setLoading(true); setError('')
    const oddsNum = parseFloat(form.odds)
    const stakeNum = parseFloat(form.stake)
    const { error: dbError } = await supabase.from('bet_slips').insert({
      user_id: userId, match_name: form.match_name, league: form.league || null,
      bet_type: form.bet_type, selection: form.selection, odds: oddsNum, stake: stakeNum,
      bookmaker: form.bookmaker || null, potential_return: oddsNum * stakeNum,
      result: 'pending', profit_loss: 0,
      match_date: form.match_date || null, notes: form.notes || null,
    })
    if (dbError) { setError(dbError.message) } else {
      setForm({ match_name: '', league: '', bet_type: 'Match Result (1X2)', selection: '', odds: '', stake: '', bookmaker: '', match_date: '', notes: '' })
      setUploadedImage(null); setSelectedFixture(null); setSelectedSelection(null); setMarkets([])
      setSuccess(true); setTimeout(() => setSuccess(false), 3000)
      onBetAdded()
    }
    setLoading(false)
  }

  // ── Submit ACCA ──
  async function handleSubmitAcca(e: React.FormEvent) {
    e.preventDefault()
    if (onBetAttempt && !onBetAttempt()) return
    if (accaLegs.length < 2) { setError('Add at least 2 legs for an accumulator'); return }
    if (!accaStake) { setError('Enter a stake'); return }
    setLoading(true); setError('')
    const stakeNum = parseFloat(accaStake)
    const selectionSummary = accaLegs.map(l => `${l.match_name}: ${l.selection} @ ${l.odds}`).join(' | ')
    const { error: dbError } = await supabase.from('bet_slips').insert({
      user_id: userId,
      match_name: `ACCA (${accaLegs.length} legs)`,
      league: accaLegs[0]?.league || null,
      bet_type: 'Accumulator',
      selection: selectionSummary,
      odds: Math.round(accaCombinedOdds * 100) / 100,
      stake: stakeNum,
      bookmaker: accaLegs[0] ? accaBookmaker || null : null,
      potential_return: Math.round(accaCombinedOdds * stakeNum * 100) / 100,
      result: 'pending',
      profit_loss: 0,
      notes: JSON.stringify(accaLegs),
    })
    if (dbError) { setError(dbError.message) } else {
      setAccaLegs([]); setAccaStake(''); setAccaFixture(null); setAccaMarkets([])
      setSuccess(true); setTimeout(() => setSuccess(false), 3000)
      onBetAdded()
    }
    setLoading(false)
  }

  const filteredPickerFixtures = pickerSearch
    ? pickerFixtures.filter(f => `${f.home_team} ${f.away_team} ${f.league}`.toLowerCase().includes(pickerSearch.toLowerCase()))
    : pickerFixtures
  const accaFilteredFixtures = accaPickerSearch
    ? pickerFixtures.filter(f => `${f.home_team} ${f.away_team} ${f.league}`.toLowerCase().includes(accaPickerSearch.toLowerCase()))
    : pickerFixtures

  return (
    <div className="relative bg-[#0E1628] border border-white/[0.07] rounded-2xl overflow-hidden">
      {/* Paywall overlay */}
      {isAtPaywall && (
        <div className="absolute inset-0 z-10 rounded-2xl flex flex-col items-center justify-center cursor-pointer"
          style={{ background: 'rgba(6,9,20,0.9)', backdropFilter: 'blur(4px)' }}
          onClick={onShowPaywall}>
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-white font-bold text-sm mb-1">Free limit reached</p>
          <p className="text-slate-400 text-xs mb-4 text-center max-w-[200px]">Upgrade to Pro to continue logging bets</p>
          <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">Upgrade to Pro →</button>
        </div>
      )}

      {/* Header + mode toggle */}
      <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-3">
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
        {/* Single / ACCA toggle */}
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
          {(['single', 'acca'] as const).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${mode === m ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>
              {m === 'single' ? 'Single' : 'ACCA'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">

        {/* ═══════════════════════════════ SINGLE MODE ═══════════════════════════════ */}
        {mode === 'single' && (
          <>
            {/* Photo upload zone */}
            <div className={`relative border-2 border-dashed rounded-xl p-4 mb-5 text-center cursor-pointer transition-all ${dragOver ? 'border-blue-500/60 bg-blue-500/8' : 'border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]'}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handlePhotoUpload(f) }}
              onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} />
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
                  <button type="button" onClick={e => { e.stopPropagation(); setUploadedImage(null) }} className="ml-auto text-slate-600 hover:text-slate-400 text-xs">✕</button>
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

            <form onSubmit={handleSubmitSingle} className="space-y-3.5">

              {/* Match picker */}
              <div ref={pickerRef} className="relative">
                <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Match *</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="e.g. Arsenal vs Chelsea" value={form.match_name}
                    onChange={e => { setForm(p => ({ ...p, match_name: e.target.value })); if (selectedFixture) setSelectedFixture(null) }}
                    className="flex-1 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors" />
                  <button type="button" onClick={openPicker}
                    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap ${showPicker ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/[0.04] border-white/[0.1] text-slate-400 hover:text-white hover:border-white/[0.2]'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Pick game
                  </button>
                </div>
                {showPicker && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0a1120] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden" style={{ maxHeight: '320px', display: 'flex', flexDirection: 'column' }}>
                    <div className="p-3 border-b border-white/[0.07] shrink-0">
                      <input autoFocus type="text" placeholder="Search team or league…" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-3 pr-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/40" />
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {pickerLoading ? (
                        <div className="flex items-center justify-center gap-2 py-8">
                          <div className="w-4 h-4 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
                          <span className="text-slate-500 text-sm">Loading…</span>
                        </div>
                      ) : (
                        Object.entries(groupByDate(filteredPickerFixtures)).map(([label, fixtures]) => (
                          <div key={label}>
                            <div className="px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.05]">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{label}</span>
                            </div>
                            {fixtures.map(f => (
                              <button key={f.id} type="button" onClick={() => selectFixture(f)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left border-b border-white/[0.04] last:border-0">
                                <span className="text-slate-500 text-[11px] font-mono w-10 shrink-0">{new Date(f.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {f.home_logo && <img src={f.home_logo} alt="" className="w-4 h-4 object-contain shrink-0" />}
                                    <span className="text-white text-xs font-semibold truncate">{f.home_team}</span>
                                    <span className="text-slate-600 text-[10px] shrink-0">vs</span>
                                    {f.away_logo && <img src={f.away_logo} alt="" className="w-4 h-4 object-contain shrink-0" />}
                                    <span className="text-white text-xs font-semibold truncate">{f.away_team}</span>
                                  </div>
                                  <p className="text-slate-600 text-[10px] mt-0.5">{f.league_flag} {f.league}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* League + Bookmaker */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">League</label>
                  <select value={form.league} onChange={e => setForm(p => ({ ...p, league: e.target.value }))}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/40">
                    <option value="">Any league</option>
                    {LEAGUES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Bookmaker</label>
                  <select value={form.bookmaker} onChange={e => setForm(p => ({ ...p, bookmaker: e.target.value }))}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/40">
                    <option value="">Select bookie</option>
                    {BOOKMAKERS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              {/* ── MARKET BROWSER ─────────────────────────────────────────── */}
              {selectedFixture ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide">
                      {form.bookmaker ? `${form.bookmaker} Markets` : 'Select Your Bet *'}
                    </label>
                    {markets.length > 0 && (
                      <span className="text-slate-600 text-[10px]">{markets.length} markets</span>
                    )}
                  </div>

                  {!form.bookmaker && (
                    <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl px-4 py-3 text-slate-500 text-xs text-center">
                      ↑ Select a bookmaker to see live markets
                    </div>
                  )}

                  {form.bookmaker && marketsLoading && (
                    <div className="flex items-center justify-center gap-2 border border-white/[0.07] rounded-xl px-4 py-5">
                      <div className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                      <span className="text-slate-500 text-xs">Loading {form.bookmaker} markets…</span>
                    </div>
                  )}

                  {form.bookmaker && !marketsLoading && markets.length === 0 && (
                    <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl px-4 py-3 text-slate-500 text-xs text-center">
                      No markets available for this fixture — enter selection manually below
                    </div>
                  )}

                  {form.bookmaker && !marketsLoading && markets.length > 0 && (
                    <>
                      {/* Search bar */}
                      <input type="text" placeholder="Search markets…" value={marketSearch} onChange={e => setMarketSearch(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-blue-500/40 mb-2" />

                      {/* Grouped market accordion */}
                      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'thin' }}>
                        {Object.entries(grouped).map(([cat, mList]) => (
                          <div key={cat} className="border border-white/[0.07] rounded-xl overflow-hidden">
                            <button type="button" onClick={() => toggleCategory(cat)}
                              className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
                              <span className="text-white text-xs font-bold">{cat}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-600 text-[10px]">{mList.reduce((s, m) => s + m.selections.length, 0)} opts</span>
                                <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform ${openCategories.has(cat) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            {openCategories.has(cat) && (
                              <div className="divide-y divide-white/[0.04]">
                                {mList.map(market => (
                                  <div key={market.name}>
                                    {mList.length > 1 && (
                                      <div className="px-3 py-1.5 bg-white/[0.02]">
                                        <span className="text-slate-500 text-[10px] font-semibold">{market.name}</span>
                                      </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-px bg-white/[0.04]">
                                      {market.selections.map(sel => (
                                        <button key={sel.label} type="button"
                                          onClick={() => applySelection(market.name, sel.label, sel.odds)}
                                          className={`flex items-center justify-between px-3 py-2.5 text-xs font-semibold transition-all bg-[#0E1628] hover:bg-blue-500/10 ${
                                            selectedSelection?.label === sel.label && selectedSelection?.market === market.name
                                              ? 'bg-blue-500/20 text-blue-200' : 'text-slate-300'
                                          }`}>
                                          <span className="truncate mr-2">{sel.label}</span>
                                          <span className={`font-black tabular-nums shrink-0 ${
                                            selectedSelection?.label === sel.label && selectedSelection?.market === market.name
                                              ? 'text-blue-300' : 'text-white'
                                          }`}>{sel.odds.toFixed(2)}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Show selected */}
                  {selectedSelection && (
                    <div className="mt-2 flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
                      <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-blue-200 text-xs font-semibold truncate">{selectedSelection.label}</span>
                      <span className="text-blue-300 font-black text-sm ml-auto shrink-0">{selectedSelection.odds.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Manual entry when no fixture selected */
                <div className="space-y-3.5">
                  <div>
                    <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Your Selection *</label>
                    <input type="text" placeholder="e.g. Arsenal Win, Over 2.5, BTTS Yes" value={form.selection}
                      onChange={e => setForm(p => ({ ...p, selection: e.target.value }))}
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/40" />
                  </div>
                </div>
              )}

              {/* Odds + Stake */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Odds *</label>
                  <input type="number" step="0.01" min="1" placeholder="2.50" value={form.odds}
                    onChange={e => setForm(p => ({ ...p, odds: e.target.value }))}
                    className={`w-full bg-white/[0.03] border rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none transition-colors ${selectedSelection ? 'border-blue-500/30' : 'border-white/[0.07] focus:border-blue-500/40'}`} />
                </div>
                <div>
                  <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Stake (£) *</label>
                  <input type="number" step="0.01" min="0" placeholder="10.00" value={form.stake}
                    onChange={e => setForm(p => ({ ...p, stake: e.target.value }))}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/40" />
                </div>
              </div>

              {/* Date + Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Match Date</label>
                  <input type="date" value={form.match_date} onChange={e => setForm(p => ({ ...p, match_date: e.target.value }))}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/40" />
                </div>
                <div>
                  <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Notes</label>
                  <input type="text" placeholder="Optional…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/40" />
                </div>
              </div>

              {/* P&L calculator */}
              {odds > 1 && stake > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
                  <div className="grid grid-cols-3 divide-x divide-white/[0.07]">
                    <div className="px-4 py-3 text-center"><p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Stake</p><p className="text-white font-bold">£{stake.toFixed(2)}</p></div>
                    <div className="px-4 py-3 text-center"><p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Return</p><p className="text-white font-bold">£{potentialReturn.toFixed(2)}</p></div>
                    <div className="px-4 py-3 text-center"><p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Profit</p><p className="text-emerald-400 font-black">+£{potentialProfit.toFixed(2)}</p></div>
                  </div>
                </div>
              )}

              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs font-medium">{error}</div>}
              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-xs font-medium flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  Bet slip saved!
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm">
                {loading ? 'Saving…' : '+ Add Bet Slip'}
              </button>
            </form>
          </>
        )}

        {/* ═══════════════════════════════ ACCA MODE ═════════════════════════════════ */}
        {mode === 'acca' && (
          <form onSubmit={handleSubmitAcca} className="space-y-4">

            {/* Bookmaker for ACCA */}
            <div>
              <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Bookmaker</label>
              <select value={accaBookmaker} onChange={e => setAccaBookmaker(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/40">
                <option value="">Select bookmaker (optional)</option>
                {BOOKMAKERS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* ACCA legs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide">
                  Legs ({accaLegs.length})
                </label>
                {accaLegs.length >= 2 && (
                  <span className="text-orange-400 text-[10px] font-bold">
                    Combined odds: {accaCombinedOdds.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Existing legs */}
              {accaLegs.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {accaLegs.map((leg, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-bold truncate">{leg.match_name}</p>
                        <p className="text-slate-500 text-[10px] truncate">{leg.selection}</p>
                      </div>
                      <span className="text-white font-black text-sm shrink-0">{leg.odds.toFixed(2)}</span>
                      <button type="button" onClick={() => removeAccaLeg(i)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0 ml-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add leg — fixture picker */}
              <div ref={accaPickerRef} className="relative">
                {!accaFixture ? (
                  <button type="button" onClick={() => { setShowAccaPicker(true); fetchFixtures() }}
                    className="w-full flex items-center justify-center gap-2 border border-dashed border-white/[0.12] rounded-xl py-3 text-slate-500 hover:text-white hover:border-white/[0.25] transition-all text-sm font-semibold">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add a leg
                  </button>
                ) : (
                  <div className="border border-blue-500/20 bg-blue-500/5 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-white text-xs font-bold">{accaFixture.home_team} vs {accaFixture.away_team}</p>
                      <button type="button" onClick={() => { setAccaFixture(null); setAccaMarkets([]) }} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
                    </div>
                    {accaMarketsLoading && (
                      <div className="flex items-center gap-2 py-2">
                        <div className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                        <span className="text-slate-500 text-xs">Loading markets…</span>
                      </div>
                    )}
                    {!accaMarketsLoading && accaMarkets.length === 0 && (
                      <p className="text-slate-500 text-xs">{accaBookmaker ? 'No markets available' : 'Select a bookmaker above to see markets'}</p>
                    )}
                    {!accaMarketsLoading && accaMarkets.length > 0 && (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                        {(() => {
                          const accaGrouped = CATEGORY_ORDER.reduce<Record<string, Market[]>>((acc, cat) => {
                            const ms = accaMarkets.filter(m => m.category === cat)
                            if (ms.length) acc[cat] = ms
                            return acc
                          }, {})
                          return Object.entries(accaGrouped).map(([cat, mList]) => (
                            <div key={cat}>
                              <p className="text-slate-500 text-[10px] font-black uppercase tracking-wider px-1 mb-1">{cat}</p>
                              <div className="grid grid-cols-2 gap-px bg-white/[0.04] rounded-lg overflow-hidden">
                                {mList.flatMap(m => m.selections).map((sel, si) => (
                                  <button key={si} type="button" onClick={() => addAccaLeg(mList[0].name, sel.label, sel.odds)}
                                    className="flex items-center justify-between px-3 py-2 bg-[#0E1628] hover:bg-blue-500/15 text-xs transition-colors">
                                    <span className="text-slate-300 truncate mr-2">{sel.label}</span>
                                    <span className="text-white font-black tabular-nums shrink-0">{sel.odds.toFixed(2)}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Fixture dropdown */}
                {showAccaPicker && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0a1120] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden" style={{ maxHeight: '280px', display: 'flex', flexDirection: 'column' }}>
                    <div className="p-3 border-b border-white/[0.07] shrink-0">
                      <input autoFocus type="text" placeholder="Search…" value={accaPickerSearch} onChange={e => setAccaPickerSearch(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-3 pr-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none" />
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {Object.entries(groupByDate(accaFilteredFixtures)).map(([label, fixtures]) => (
                        <div key={label}>
                          <div className="px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.05]">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{label}</span>
                          </div>
                          {fixtures.map(f => {
                            const alreadyAdded = accaLegs.some(l => l.fixture_id === f.id)
                            return (
                              <button key={f.id} type="button" disabled={alreadyAdded}
                                onClick={() => { setAccaFixture(f); setShowAccaPicker(false); setAccaPickerSearch('') }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left border-b border-white/[0.04] last:border-0 ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[0.05]'}`}>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-white text-xs font-semibold truncate">{f.home_team}</span>
                                    <span className="text-slate-600 text-[10px]">vs</span>
                                    <span className="text-white text-xs font-semibold truncate">{f.away_team}</span>
                                  </div>
                                  <p className="text-slate-600 text-[10px]">{f.league_flag} {f.league}</p>
                                </div>
                                {alreadyAdded && <span className="text-emerald-400 text-[10px] font-bold shrink-0">Added ✓</span>}
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ACCA P&L */}
            {accaLegs.length >= 2 && (
              <>
                <div>
                  <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide block mb-1.5">Stake (£) *</label>
                  <input type="number" step="0.01" min="0" placeholder="10.00" value={accaStake}
                    onChange={e => setAccaStake(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/40" />
                </div>
                {accaStakeNum > 0 && (
                  <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
                    <div className="grid grid-cols-3 divide-x divide-white/[0.07]">
                      <div className="px-4 py-3 text-center"><p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Odds</p><p className="text-orange-400 font-black">{accaCombinedOdds.toFixed(2)}</p></div>
                      <div className="px-4 py-3 text-center"><p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Return</p><p className="text-white font-bold">£{accaReturn.toFixed(2)}</p></div>
                      <div className="px-4 py-3 text-center"><p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Profit</p><p className="text-emerald-400 font-black">+£{accaProfit.toFixed(2)}</p></div>
                    </div>
                  </div>
                )}
              </>
            )}

            {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs font-medium">{error}</div>}
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-xs font-medium flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                Accumulator saved!
              </div>
            )}

            <button type="submit" disabled={loading || accaLegs.length < 2}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors text-sm">
              {loading ? 'Saving…' : accaLegs.length < 2 ? `Add ${2 - accaLegs.length} more leg${accaLegs.length === 1 ? '' : 's'}…` : `Save ${accaLegs.length}-Leg Accumulator`}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
