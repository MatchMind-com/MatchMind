'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * BetSlipScanner — modal that lets users upload a photo of a physical
 * betting-shop slip (single OR accumulator) and add it to their tracked
 * history.
 *
 * Flow:
 *   1. Pick a photo (camera on mobile, file picker on desktop)
 *   2. Preview + "Analyse slip" → POST multipart to /api/upload-bet
 *   3. AI returns structured legs → editable form (every field tweakable)
 *   4. "Save to history" → POST JSON with legs[] → bet_slips row created
 *   5. Success → onSaved() callback closes modal + reloads parent
 *
 * Design choices:
 *   - One modal, three steps (pick → review → done) so users never lose
 *     their place.
 *   - Aggressive client-side compression (max 1600px) to keep upload fast
 *     on phone networks and within the 10MB API cap.
 *   - Every detected leg is editable — OCR is good but not perfect, and
 *     trust comes from "I can fix what's wrong before saving."
 *   - Stake/odds inputs use font-stat for the editorial look, matching
 *     the rest of the History tab.
 */

interface ParsedLeg {
  match_name: string
  selection: string
  odds: number
  league?: string | null
  match_date?: string | null
  bet_type?: string | null
}

interface ParsedSlip {
  type: 'single' | 'accumulator'
  bookmaker: string | null
  currency: string | null
  total_stake: number | null
  total_odds: number | null
  potential_return: number | null
  legs: ParsedLeg[]
  parse_notes?: string | null
}

interface Props {
  onClose: () => void
  onSaved: () => void
}

type Step = 'pick' | 'parsing' | 'review' | 'saving' | 'done'

const inputCls =
  'w-full bg-bg-base border border-border-subtle px-3 py-2 text-fg text-sm focus:outline-none focus:border-brand'

// HEIC/HEIF (iPhone default) and a few other formats can't be rendered by
// the browser <img> tag and the OpenAI vision API also rejects HEIC. We
// detect and ask the user to convert / re-take.
const UNSUPPORTED_TYPES = /^image\/(heic|heif|tiff|x-icon|svg\+xml)$/i

function unsupportedReason(file: File): string | null {
  if (UNSUPPORTED_TYPES.test(file.type) || /\.heic$|\.heif$/i.test(file.name)) {
    return 'iPhone HEIC photos aren’t supported. On iPhone go to Settings → Camera → Formats → "Most Compatible" then re-take the photo, or take a screenshot of the slip and upload that instead.'
  }
  if (file.size < 5 * 1024) {
    return 'That image is too small to read. Please use a clearer / larger photo of the slip.'
  }
  return null
}

// Browser-side image compression — accept any image, scale down to max
// 1600px on the longer side and re-encode at q=0.85 JPEG. Drops typical
// phone-camera 8-12MB shots to ~600KB without losing OCR accuracy.
async function compressImage(file: File): Promise<Blob> {
  if (file.size < 1.5 * 1024 * 1024) return file
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataUrl
  })
  const maxDim = 1600
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.round(img.width * ratio)
  const h = Math.round(img.height * ratio)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, w, h)
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85)
  })
}

export default function BetSlipScanner({ onClose, onSaved }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [step, setStep] = useState<Step>('pick')
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [imgFailed, setImgFailed] = useState(false)
  const [parsed, setParsed] = useState<ParsedSlip | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  // Track repeated failures so we can offer "switch to manual entry"
  const [failureCount, setFailureCount] = useState(0)

  // Revoke blob URL on unmount / change
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  function pickFile() {
    fileInputRef.current?.click()
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/') && !/\.(heic|heif|jpe?g|png|webp|gif)$/i.test(f.name)) {
      setError('That file isn’t an image. Try a JPG or PNG photo.')
      return
    }
    const reason = unsupportedReason(f)
    if (reason) {
      setError(reason)
      // Don't set the preview — they need to pick a different file.
      return
    }
    setError(null)
    setOriginalFile(f)
    setImgFailed(false)
    const url = URL.createObjectURL(f)
    setPreviewUrl(url)
    setParsed(null)
  }

  async function analyse() {
    if (!originalFile) return
    setStep('parsing')
    setError(null)
    try {
      let blob: Blob
      try {
        blob = await compressImage(originalFile)
      } catch (compressErr: any) {
        throw new Error(
          `Couldn't process this image (${compressErr?.message || 'compression failed'}). Try a JPG or PNG photo.`
        )
      }

      const fd = new FormData()
      fd.append('image', blob, originalFile.name.replace(/\.[^.]+$/, '') + '.jpg')

      let res: Response
      try {
        res = await fetch('/api/upload-bet', { method: 'POST', body: fd })
      } catch (netErr: any) {
        throw new Error('Network error — check your connection and try again.')
      }

      // Try to parse JSON. The API always returns JSON for our paths but a
      // proxy/edge-layer error could return HTML — guard against that.
      let data: any = null
      try {
        data = await res.json()
      } catch {
        throw new Error(
          `Server returned non-JSON response (HTTP ${res.status}). The slip parser may be temporarily down.`
        )
      }

      if (!res.ok) {
        // Status-specific messaging — the user deserves better than "Failed".
        if (res.status === 401) {
          throw new Error('You need to be signed in to scan slips. Refresh and try again.')
        }
        if (res.status === 413) {
          throw new Error('Image too large — please use a photo under 10MB.')
        }
        if (res.status === 422) {
          // No bets detected. Prefer the AI's parse_notes if present.
          const note = data?.parse_notes
          throw new Error(
            note
              ? `Couldn't read any bets on this image. AI noted: "${note}". Try a clearer / better-lit photo, or one that fits the whole slip in frame.`
              : "Couldn't read any bets on this image. Make sure the photo is sharp, well-lit, and shows the whole slip."
          )
        }
        if (res.status === 429) {
          throw new Error('AI quota exceeded. Try again in a few minutes.')
        }
        if (res.status === 502) {
          throw new Error('AI couldn\'t read the slip — try a clearer / sharper photo, or crop to just the slip.')
        }
        throw new Error(data?.error || `Server error (HTTP ${res.status})`)
      }

      const slip = data as ParsedSlip
      if (!Array.isArray(slip.legs) || slip.legs.length === 0) {
        throw new Error(
          slip?.parse_notes
            ? `No bets found on this image. AI noted: "${slip.parse_notes}". Try a clearer photo.`
            : 'No bets found on this image. Try a clearer photo of the slip.'
        )
      }
      // Sane defaults so the review form is filled in
      if (!slip.total_stake) slip.total_stake = 10
      if (!slip.total_odds && slip.legs.length) {
        slip.total_odds = Math.round(slip.legs.reduce((a, l) => a * l.odds, 1) * 100) / 100
      }
      setParsed(slip)
      setStep('review')
      setFailureCount(0)
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : 'Failed to analyse slip'
      // eslint-disable-next-line no-console
      console.error('[BetSlipScanner] analyse failed:', e)
      setError(msg)
      setStep('pick')
      setFailureCount((n) => n + 1)
    }
  }

  /**
   * Hand off to a clean manual-entry review screen so the user isn't stuck
   * when AI vision can't read their slip. Pre-fills with a sensible blank
   * single-leg form they can edit and save.
   */
  function startBlankAcca() {
    setError(null)
    setParsed({
      type: 'single',
      bookmaker: null,
      currency: null,
      total_stake: 10,
      total_odds: 2.0,
      potential_return: 20,
      legs: [
        {
          match_name: '',
          selection: '',
          odds: 2.0,
          league: null,
          match_date: new Date().toISOString().slice(0, 10),
          bet_type: 'Match Result (1X2)',
        },
      ],
      parse_notes: 'Manual entry — AI vision skipped',
    })
    setStep('review')
  }

  function updateLeg(idx: number, patch: Partial<ParsedLeg>) {
    if (!parsed) return
    const next = { ...parsed, legs: parsed.legs.map((l, i) => i === idx ? { ...l, ...patch } : l) }
    // Recompute total_odds when any leg odds change
    if (patch.odds != null) {
      next.total_odds = Math.round(next.legs.reduce((a, l) => a * (l.odds || 1), 1) * 100) / 100
    }
    setParsed(next)
  }

  function removeLeg(idx: number) {
    if (!parsed) return
    const legs = parsed.legs.filter((_, i) => i !== idx)
    const total_odds = legs.length ? Math.round(legs.reduce((a, l) => a * (l.odds || 1), 1) * 100) / 100 : null
    setParsed({
      ...parsed,
      legs,
      total_odds,
      type: legs.length > 1 ? 'accumulator' : 'single',
    })
  }

  function addLeg() {
    if (!parsed) return
    setParsed({
      ...parsed,
      legs: [...parsed.legs, {
        match_name: '',
        selection: '',
        odds: 2.0,
        league: null,
        match_date: null,
        bet_type: 'Match Result (1X2)',
      }],
      type: parsed.legs.length + 1 > 1 ? 'accumulator' : 'single',
    })
  }

  async function save() {
    if (!parsed) return
    // Final validation
    for (const [i, l] of parsed.legs.entries()) {
      if (!l.match_name.trim()) return setError(`Leg ${i + 1}: match name is required`)
      if (!l.selection.trim()) return setError(`Leg ${i + 1}: selection is required`)
      if (!l.odds || l.odds <= 1) return setError(`Leg ${i + 1}: odds must be > 1`)
    }
    if (!parsed.total_stake || parsed.total_stake <= 0) {
      return setError('Stake must be greater than 0')
    }
    setError(null)
    setStep('saving')
    try {
      const res = await fetch('/api/upload-bet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          legs: parsed.legs,
          total_stake: parsed.total_stake,
          total_odds: parsed.total_odds,
          bookmaker: parsed.bookmaker,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setSavedId(data?.id ?? null)
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
      setStep('review')
    }
  }

  function reset() {
    setStep('pick')
    setError(null)
    setParsed(null)
    setSavedId(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setOriginalFile(null)
  }

  const isAcca = (parsed?.legs.length ?? 0) > 1
  const potentialReturn =
    parsed && parsed.total_odds && parsed.total_stake
      ? Math.round(parsed.total_odds * parsed.total_stake * 100) / 100
      : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      onClick={() => { if (step === 'pick' || step === 'review' || step === 'done') onClose() }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative bg-bg-surface border border-border-strong w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-border-subtle sticky top-0 bg-bg-surface z-10">
          <div>
            <h3 className="text-fg font-bold text-base leading-tight">Scan betting slip</h3>
            <p className="text-fg-muted text-[11px] mt-0.5">
              {step === 'pick' && 'Upload a photo of your shop slip — single or accumulator'}
              {step === 'parsing' && 'Reading the slip with AI vision…'}
              {step === 'review' && 'Check the details, edit anything wrong, then save'}
              {step === 'saving' && 'Saving to your history…'}
              {step === 'done' && 'Bet added to your track record'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-muted hover:text-fg text-xl leading-none px-2 -mr-2"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="p-5">
          {/* Error banner */}
          {error && (
            <div className="bg-loss/10 border border-loss/30 text-loss text-xs p-3 mb-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <span className="leading-relaxed">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-loss/70 hover:text-loss text-[10px] font-bold uppercase tracking-wider shrink-0"
                >
                  Dismiss
                </button>
              </div>
              {failureCount >= 2 && step === 'pick' && (
                <div className="pt-2 border-t border-loss/20 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-loss/80 text-[11px]">
                    Photo not working? You can enter the bet manually.
                  </span>
                  <button
                    type="button"
                    onClick={startBlankAcca}
                    className="text-[10px] font-bold uppercase tracking-wider py-1 px-2.5 rounded border border-loss/40 text-loss hover:bg-loss/10 transition-colors"
                  >
                    Enter manually →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP: pick */}
          {step === 'pick' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onFileChosen}
                className="hidden"
              />

              {previewUrl ? (
                <>
                  <div className="bg-bg-base border border-border-subtle p-3">
                    {imgFailed ? (
                      <div className="w-full bg-loss/5 border border-loss/30 p-6 text-center">
                        <p className="text-loss text-sm font-semibold mb-1">Can’t display this image</p>
                        <p className="text-fg-muted text-[11px] leading-relaxed">
                          Your browser couldn’t render this file format. iPhone HEIC photos are a common cause —
                          try a screenshot of the slip, or change Camera → Formats to "Most Compatible" in Settings.
                        </p>
                      </div>
                    ) : (
                      <img
                        src={previewUrl}
                        alt="Bet slip preview"
                        className="w-full max-h-[50vh] object-contain"
                        onError={() => setImgFailed(true)}
                      />
                    )}
                  </div>
                  {originalFile && (
                    <p className="text-fg-muted text-[10px] text-center font-stat">
                      {originalFile.name} · {(originalFile.size / 1024).toFixed(0)}KB · {originalFile.type || 'unknown type'}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={pickFile}
                      className="text-fg-secondary hover:text-fg text-xs font-bold uppercase tracking-wider"
                    >
                      ↻ Choose another photo
                    </button>
                    <button
                      type="button"
                      onClick={analyse}
                      disabled={imgFailed}
                      className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Analyse slip →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={pickFile}
                    className="w-full border-2 border-dashed border-border-strong hover:border-brand p-8 sm:p-12 transition-colors group"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 bg-brand/10 group-hover:bg-brand/20 flex items-center justify-center transition-colors">
                        <CameraIcon />
                      </div>
                      <p className="text-fg font-bold text-base">Tap to take photo or upload</p>
                      <p className="text-fg-muted text-xs leading-relaxed text-center max-w-sm">
                        On phone you’ll get the camera. On desktop you’ll pick a saved image.<br />
                        We support singles, doubles, trebles and any-fold accumulators.
                      </p>
                    </div>
                  </button>
                  <p className="text-fg-muted text-[11px] text-center">
                    Photos are sent to AI for parsing only — never shared, never stored after the upload completes.
                  </p>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={startBlankAcca}
                      className="text-fg-muted hover:text-brand text-[11px] font-bold uppercase tracking-wider transition-colors"
                    >
                      or enter manually →
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP: parsing */}
          {step === 'parsing' && (
            <div className="py-12 text-center">
              <div className="inline-block w-10 h-10 border-3 border-brand border-t-transparent animate-spin mb-4" />
              <p className="text-fg font-semibold mb-1">Reading your slip…</p>
              <p className="text-fg-muted text-xs">Usually takes 5-10 seconds</p>
            </div>
          )}

          {/* STEP: review */}
          {step === 'review' && parsed && (
            <div className="space-y-4">
              {/* Slip-level summary */}
              <div className="bg-bg-elevated p-3 border border-border-subtle grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryStat label="Type" value={isAcca ? `${parsed.legs.length}-fold` : 'Single'} />
                <SummaryStat
                  label="Total odds"
                  value={parsed.total_odds ? parsed.total_odds.toFixed(2) : '—'}
                  mono
                />
                <SummaryStat
                  label="Stake"
                  value={parsed.total_stake ? parsed.total_stake.toFixed(2) : '—'}
                  mono
                />
                <SummaryStat
                  label="Returns"
                  value={potentialReturn ? potentialReturn.toFixed(2) : '—'}
                  accent="success"
                  mono
                />
              </div>

              {/* Bookmaker + stake controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
                    Bookmaker
                  </label>
                  <input
                    type="text"
                    value={parsed.bookmaker ?? ''}
                    onChange={(e) => setParsed({ ...parsed, bookmaker: e.target.value })}
                    placeholder="Bet365"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
                    Stake (units)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={parsed.total_stake ?? ''}
                    onChange={(e) =>
                      setParsed({ ...parsed, total_stake: parseFloat(e.target.value) || 0 })
                    }
                    className={`${inputCls} font-stat`}
                  />
                </div>
                <div>
                  <label className="block text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
                    Total odds
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    value={parsed.total_odds ?? ''}
                    onChange={(e) =>
                      setParsed({ ...parsed, total_odds: parseFloat(e.target.value) || 0 })
                    }
                    className={`${inputCls} font-stat`}
                  />
                </div>
              </div>

              {/* Legs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="eyebrow">Legs ({parsed.legs.length})</p>
                  <button
                    type="button"
                    onClick={addLeg}
                    className="text-brand hover:underline text-[11px] font-bold uppercase tracking-wider"
                  >
                    + Add leg
                  </button>
                </div>

                {parsed.legs.map((leg, i) => (
                  <div
                    key={i}
                    className="bg-bg-base/60 border border-border-subtle p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-stat text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                        Leg {i + 1}
                      </span>
                      {parsed.legs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLeg(i)}
                          className="text-fg-muted hover:text-loss text-[10px] font-bold uppercase tracking-wider"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={leg.match_name}
                        onChange={(e) => updateLeg(i, { match_name: e.target.value })}
                        placeholder="Home vs Away"
                        className={inputCls}
                      />
                      <input
                        type="text"
                        value={leg.league ?? ''}
                        onChange={(e) => updateLeg(i, { league: e.target.value })}
                        placeholder="League (optional)"
                        className={inputCls}
                      />
                      <input
                        type="text"
                        value={leg.selection}
                        onChange={(e) => updateLeg(i, { selection: e.target.value })}
                        placeholder="Selection (e.g. Home Win, Over 2.5)"
                        className={`sm:col-span-2 ${inputCls}`}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="1.01"
                        value={leg.odds || ''}
                        onChange={(e) => updateLeg(i, { odds: parseFloat(e.target.value) || 0 })}
                        placeholder="Odds"
                        className={`${inputCls} font-stat`}
                      />
                      <input
                        type="date"
                        value={leg.match_date ?? ''}
                        onChange={(e) => updateLeg(i, { match_date: e.target.value || null })}
                        className={inputCls}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {parsed.parse_notes && (
                <p className="text-fg-muted text-[11px] italic bg-bg-base/40 border border-border-subtle p-2">
                  AI note: {parsed.parse_notes}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={reset}
                  className="text-fg-secondary hover:text-fg text-xs font-bold uppercase tracking-wider"
                >
                  ← Start over
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Save to history →
                </button>
              </div>
            </div>
          )}

          {/* STEP: saving */}
          {step === 'saving' && (
            <div className="py-12 text-center">
              <div className="inline-block w-10 h-10 border-3 border-brand border-t-transparent animate-spin mb-4" />
              <p className="text-fg font-semibold">Saving…</p>
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 mx-auto bg-success/15 border border-success/40 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-success">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-fg font-bold text-base mb-1">Bet saved</p>
                <p className="text-fg-muted text-xs">
                  {parsed && (parsed.legs.length > 1
                    ? `${parsed.legs.length}-leg accumulator added — track each leg from the History tab`
                    : 'Single bet added to your track record')}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-2 bg-bg-base border border-border-subtle hover:border-border-strong text-fg-secondary text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Scan another
                </button>
                <button
                  type="button"
                  onClick={() => { onSaved(); onClose() }}
                  className="px-5 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  mono,
  accent = 'neutral',
}: {
  label: string
  value: string
  mono?: boolean
  accent?: 'neutral' | 'success'
}) {
  return (
    <div>
      <p className="text-fg-muted text-[10px] font-bold uppercase tracking-wider mb-0.5">{label}</p>
      <p
        className={`text-base font-bold leading-tight ${mono ? 'font-stat' : ''} ${
          accent === 'success' ? 'text-success' : 'text-fg'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
