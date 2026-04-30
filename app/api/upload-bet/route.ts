import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/upload-bet
 *
 * Three modes, dispatched on Content-Type:
 *
 * 1. multipart/form-data with `image` field → OCR a bet-slip photo (single
 *    OR accumulator) and return parsed JSON. NO DB write — the UI shows
 *    the parsed legs to the user, lets them edit, then POSTs back as JSON.
 *
 * 2. application/json with `legs` array → save an accumulator (or single
 *    bet, when legs.length === 1) to bet_slips. Acca legs are stored as
 *    JSON in the `notes` column so the existing flat schema keeps working
 *    while still letting HistoryTab render leg-by-leg detail.
 *
 * 3. application/json without `legs` → legacy manual-bet insert. Kept
 *    intact so the existing "+ Add manual bet" button doesn't regress.
 *
 * Auth-gated for both JSON paths. RLS on bet_slips guarantees a user
 * can only insert rows for themselves.
 */

type Result = 'win' | 'loss' | 'void' | 'pending'

interface ManualBetBody {
  match_name?: string | null
  league?: string | null
  bet_type?: string | null
  selection?: string | null
  odds?: number | string | null
  stake?: number | string | null
  bookmaker?: string | null
  match_date?: string | null
  notes?: string | null
  result?: Result | null
  // Accumulator path
  legs?: ParsedLeg[]
  total_odds?: number | string | null
  total_stake?: number | string | null
  currency?: string | null
}

interface ParsedLeg {
  match_name: string
  selection: string
  odds: number
  league?: string | null
  match_date?: string | null
  bet_type?: string | null
  result?: Result
}

interface ParsedSlip {
  type: 'single' | 'accumulator'
  bookmaker: string | null
  currency: string | null
  total_stake: number | null
  total_odds: number | null
  potential_return: number | null
  legs: ParsedLeg[]
  /** Free-text note returned for the user (e.g. "Photo blurry near leg 2"). */
  parse_notes?: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function isResult(v: unknown): v is Result {
  return v === 'win' || v === 'loss' || v === 'void' || v === 'pending'
}

function computePL(result: Result, odds: number, stake: number): number {
  if (result === 'win') return Math.round((odds - 1) * stake * 100) / 100
  if (result === 'loss') return -Math.round(stake * 100) / 100
  return 0
}

/** Pick a friendly N-fold name. */
function accaFoldName(n: number): string {
  if (n === 2) return 'Double'
  if (n === 3) return 'Treble'
  return `${n}-fold accumulator`
}

// ── Manual single-bet insert (legacy path) ────────────────────────────

async function handleManualInsert(req: Request, body: ManualBetBody): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const matchName = (body.match_name ?? '').toString().trim()
  const betType = (body.bet_type ?? '').toString().trim() || 'Match Result (1X2)'
  const selection = (body.selection ?? '').toString().trim()
  const odds = toNum(body.odds)
  const stake = toNum(body.stake)
  const result: Result = isResult(body.result) ? body.result : 'pending'

  if (!matchName) return NextResponse.json({ error: 'match_name is required' }, { status: 400 })
  if (!selection) return NextResponse.json({ error: 'selection is required' }, { status: 400 })
  if (!odds || odds <= 1) return NextResponse.json({ error: 'odds must be > 1' }, { status: 400 })
  if (!stake || stake <= 0) return NextResponse.json({ error: 'stake must be > 0' }, { status: 400 })

  const profitLoss = computePL(result, odds, stake)
  const potentialReturn = Math.round(odds * stake * 100) / 100

  const insertRow = {
    user_id: user.id,
    match_name: matchName,
    league: body.league ? body.league.toString().trim() || null : null,
    bet_type: betType,
    selection,
    odds,
    stake,
    bookmaker: body.bookmaker ? body.bookmaker.toString().trim() || null : null,
    potential_return: potentialReturn,
    result,
    profit_loss: profitLoss,
    match_date: body.match_date ? body.match_date.toString().slice(0, 10) : null,
    notes: body.notes ? body.notes.toString().trim() || null : null,
  }

  const { data, error } = await supabase
    .from('bet_slips')
    .insert(insertRow)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, id: data?.id ?? null })
}

// ── Accumulator insert ────────────────────────────────────────────────

async function handleAccaInsert(req: Request, body: ManualBetBody): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const legsRaw = Array.isArray(body.legs) ? body.legs : []
  if (legsRaw.length === 0) {
    return NextResponse.json({ error: 'At least one leg is required' }, { status: 400 })
  }

  // Validate each leg
  const legs: ParsedLeg[] = []
  for (const [idx, l] of legsRaw.entries()) {
    const match = (l?.match_name ?? '').toString().trim()
    const sel = (l?.selection ?? '').toString().trim()
    const oddsN = toNum(l?.odds)
    if (!match) return NextResponse.json({ error: `Leg ${idx + 1}: match name is required` }, { status: 400 })
    if (!sel) return NextResponse.json({ error: `Leg ${idx + 1}: selection is required` }, { status: 400 })
    if (!oddsN || oddsN <= 1) return NextResponse.json({ error: `Leg ${idx + 1}: odds must be > 1` }, { status: 400 })
    legs.push({
      match_name: match,
      selection: sel,
      odds: oddsN,
      league: l?.league ? String(l.league).trim() || null : null,
      match_date: l?.match_date ? String(l.match_date).slice(0, 10) : null,
      bet_type: l?.bet_type ? String(l.bet_type).trim() || null : null,
      result: isResult(l?.result) ? (l.result as Result) : 'pending',
    })
  }

  // Single-leg "acca" → store as a regular single bet (cleaner in History)
  const isSingle = legs.length === 1
  const totalOdds = toNum(body.total_odds) ??
    legs.reduce((acc, l) => acc * l.odds, 1)
  const totalStake = toNum(body.total_stake)
  if (!totalStake || totalStake <= 0) {
    return NextResponse.json({ error: 'total_stake must be > 0' }, { status: 400 })
  }

  // Overall result is derived: any loss → loss; all wins → win; else pending.
  const anyLoss = legs.some(l => l.result === 'loss')
  const allWin = legs.every(l => l.result === 'win')
  const result: Result = anyLoss ? 'loss' : (allWin && legs.length > 0 ? 'win' : 'pending')
  const profitLoss = computePL(result, totalOdds, totalStake)
  const potentialReturn = Math.round(totalOdds * totalStake * 100) / 100

  // Earliest leg date for sorting on the calendar.
  const dates = legs.map(l => l.match_date).filter(Boolean) as string[]
  dates.sort()
  const matchDate = dates[0] ?? null

  // Pretty match_name + selection for the table view.
  const matchName = isSingle
    ? legs[0].match_name
    : `${accaFoldName(legs.length)}: ${legs.map(l => l.match_name.split(/ vs | v /i)[0]).slice(0, 4).join(', ')}${legs.length > 4 ? '…' : ''}`
  const selection = isSingle
    ? legs[0].selection
    : legs.map(l => l.selection).join(' / ')
  const betType = isSingle
    ? (legs[0].bet_type || 'Match Result (1X2)')
    : `Accumulator (${accaFoldName(legs.length)})`

  // For accas store the leg detail as JSON in notes so HistoryTab can
  // render leg-by-leg view + per-leg result tracking. For singles the
  // user-facing notes string wins.
  const legPayloadJson = JSON.stringify({ kind: 'acca_legs_v1', legs })
  const userNote = body.notes ? String(body.notes).trim() : ''
  const notes = isSingle
    ? (userNote || null)
    : (userNote ? `${userNote}\n${legPayloadJson}` : legPayloadJson)

  const insertRow = {
    user_id: user.id,
    match_name: matchName,
    league: !isSingle ? null : (legs[0].league ?? null),
    bet_type: betType,
    selection,
    odds: Math.round(totalOdds * 100) / 100,
    stake: totalStake,
    bookmaker: body.bookmaker ? String(body.bookmaker).trim() || null : null,
    potential_return: potentialReturn,
    result,
    profit_loss: profitLoss,
    match_date: matchDate,
    notes,
  }

  const { data, error } = await supabase
    .from('bet_slips')
    .insert(insertRow)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, id: data?.id ?? null, legs_count: legs.length })
}

// ── OCR (multipart) ───────────────────────────────────────────────────

async function handleOCR(req: Request): Promise<NextResponse> {
  // Auth: photo OCR is gated too — burns OpenAI credits.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OpenAI key not configured' }, { status: 500 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }
  const image = formData.get('image') as File | null
  if (!image || typeof image === 'string') {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }
  // Cap file size at 10MB — vision model handles up to ~20MB but we'd rather
  // reject huge phone photos early than burn OpenAI credits and time out.
  if (image.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'Image too large — please use a photo under 10MB' },
      { status: 413 }
    )
  }

  const openai = new OpenAI({ apiKey })
  const base64 = Buffer.from(await image.arrayBuffer()).toString('base64')
  const mimeType = image.type || 'image/jpeg'

  const systemPrompt = `You are an expert OCR system specialised in betting slips from physical betting shops (Bet365, William Hill, Ladbrokes, Coral, Paddy Power, Betfair, BetMGM, FanDuel, DraftKings and similar). Extract every detail accurately and return STRICT JSON only.

Detect whether the slip is a SINGLE bet, a DOUBLE / TREBLE / N-FOLD ACCUMULATOR (multiple selections combined), or an unrelated image.

Return shape:
{
  "type": "single" | "accumulator",
  "bookmaker": "Bet365" | "William Hill" | ... | null,
  "currency": "GBP" | "USD" | "EUR" | "TRY" | ... | null,
  "total_stake": <number> | null,        // unit currency, e.g. 10.00
  "total_odds": <number> | null,         // combined decimal odds (1.85, 8.40, ...)
  "potential_return": <number> | null,   // total payout if won
  "legs": [
    {
      "match_name": "Team A vs Team B",
      "selection": "Team A to Win" | "Over 2.5" | "BTTS - Yes" | ...,
      "odds": <number>,                  // decimal odds for THIS leg only
      "league": "Premier League" | null,
      "match_date": "YYYY-MM-DD" | null,
      "bet_type": "Match Result (1X2)" | "Over/Under" | "BTTS" | "Both Teams to Score" | "Double Chance" | "Asian Handicap" | "Correct Score" | "Anytime Goalscorer" | "Half Time / Full Time" | null
    }
  ],
  "parse_notes": "short note about anything ambiguous, or null"
}

Strict rules:
1. Decimal odds only. If the slip shows fractional odds like "5/2", convert to decimal (5/2 → 3.50; 11/10 → 2.10; 1/2 → 1.50).
2. If the slip shows American odds (+150, -200), convert: positive → (odds/100)+1, negative → (100/|odds|)+1.
3. For accumulators, EACH leg must be its own entry in the legs array. The total_odds is usually the product of leg odds — verify and self-correct if rounding looks off.
4. If the photo is not a betting slip, return type="single", legs=[], and parse_notes explaining what you saw.
5. If a field cannot be read confidently, use null. Never invent values.
6. Convert team names to their canonical English form (e.g. "Man City" → "Manchester City", "Spurs" → "Tottenham", "Galatasaray" stays).
7. match_name format is always "Home vs Away" — preserve home/away order from the slip.`

  let raw = '{}'
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      max_tokens: 1500,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the bet details from this slip. Return JSON only.' },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
            },
          ],
        },
      ],
    })
    raw = response.choices[0]?.message?.content || '{}'
  } catch (e: any) {
    if (e?.status === 429) {
      return NextResponse.json(
        { error: 'OpenAI quota exceeded. Add credits at platform.openai.com/billing' },
        { status: 429 }
      )
    }
    return NextResponse.json(
      { error: 'AI failed to read the slip — try a clearer photo' },
      { status: 502 }
    )
  }

  let parsed: ParsedSlip
  try {
    const obj = JSON.parse(raw)
    const legs: ParsedLeg[] = Array.isArray(obj.legs)
      ? obj.legs
          .filter((l: any) => l?.match_name && l?.selection && Number.isFinite(Number(l.odds)) && Number(l.odds) > 1)
          .map((l: any) => ({
            match_name: String(l.match_name),
            selection: String(l.selection),
            odds: Number(l.odds),
            league: l.league ? String(l.league) : null,
            match_date: l.match_date ? String(l.match_date).slice(0, 10) : null,
            bet_type: l.bet_type ? String(l.bet_type) : null,
          }))
      : []

    parsed = {
      type: obj.type === 'accumulator' || legs.length > 1 ? 'accumulator' : 'single',
      bookmaker: obj.bookmaker ? String(obj.bookmaker) : null,
      currency: obj.currency ? String(obj.currency) : null,
      total_stake: toNum(obj.total_stake),
      total_odds: toNum(obj.total_odds) ?? (legs.length ? legs.reduce((a, l) => a * l.odds, 1) : null),
      potential_return: toNum(obj.potential_return),
      legs,
      parse_notes: obj.parse_notes ? String(obj.parse_notes) : null,
    }
  } catch {
    return NextResponse.json(
      { error: 'AI returned malformed data — try a clearer photo' },
      { status: 502 }
    )
  }

  if (!parsed.legs.length) {
    return NextResponse.json(
      {
        error: 'No bets detected on this image',
        parse_notes: parsed.parse_notes ?? null,
      },
      { status: 422 }
    )
  }

  // Round total_odds to 2 dp for display
  if (parsed.total_odds != null) {
    parsed.total_odds = Math.round(parsed.total_odds * 100) / 100
  }
  if (parsed.potential_return == null && parsed.total_odds != null && parsed.total_stake != null) {
    parsed.potential_return = Math.round(parsed.total_odds * parsed.total_stake * 100) / 100
  }

  return NextResponse.json(parsed)
}

// ── Router ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    let body: ManualBetBody
    try {
      body = (await req.json()) as ManualBetBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (Array.isArray(body.legs) && body.legs.length > 0) {
      return handleAccaInsert(req, body)
    }
    return handleManualInsert(req, body)
  }

  if (contentType.includes('multipart/form-data')) {
    return handleOCR(req)
  }

  return NextResponse.json(
    { error: 'Unsupported content-type. Send multipart/form-data (image) or application/json.' },
    { status: 415 }
  )
}
