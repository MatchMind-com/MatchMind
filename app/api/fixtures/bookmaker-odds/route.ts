import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

// API-Football bookmaker IDs
const BOOKMAKER_IDS: Record<string, number[]> = {
  'Bet365':       [8],
  'William Hill': [9],
  'Betfair':      [13],
  'Paddy Power':  [23],
  'Ladbrokes':    [4],
  'Coral':        [12],
  'Unibet':       [5],
  'Sky Bet':      [10],
  'Betway':       [11],
  'BoyleSports':  [32],
  'Pinnacle':     [29],
  '888sport':     [22],
  'Betfred':      [25],
  'Bwin':         [6],
  'Other':        [], // will try any available
}

function extractOdds(bookmaker: any) {
  const bets = bookmaker?.bets || []
  const mw   = bets.find((b: any) => b.id === 1)  // Match Winner
  const ou   = bets.find((b: any) => b.id === 5)  // Goals Over/Under
  const btts = bets.find((b: any) => b.id === 8)  // Both Teams Score
  const p = (val: string | undefined) => { const n = parseFloat(val || '0'); return n > 1 ? n : null }
  return {
    home:     p(mw?.values?.find((v: any) => v.value === 'Home')?.odd),
    draw:     p(mw?.values?.find((v: any) => v.value === 'Draw')?.odd),
    away:     p(mw?.values?.find((v: any) => v.value === 'Away')?.odd),
    over25:   p(ou?.values?.find((v: any) => v.value === 'Over 2.5')?.odd),
    under25:  p(ou?.values?.find((v: any) => v.value === 'Under 2.5')?.odd),
    btts_yes: p(btts?.values?.find((v: any) => v.value === 'Yes')?.odd),
    btts_no:  p(btts?.values?.find((v: any) => v.value === 'No')?.odd),
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fixtureId = searchParams.get('fixtureId')
  const bookmakerName = searchParams.get('bookmaker') || ''

  if (!fixtureId) {
    return NextResponse.json({ error: 'fixtureId required' }, { status: 400 })
  }

  const ids = BOOKMAKER_IDS[bookmakerName] ?? []

  try {
    // Try bookmaker-specific first
    if (ids.length > 0) {
      const url = `${BASE}/odds?fixture=${fixtureId}&bookmaker=${ids[0]}`
      const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY } })
      const json = await res.json()
      const bk = json.response?.[0]?.bookmakers?.[0]
      if (bk) {
        const odds = extractOdds(bk)
        const hasAny = Object.values(odds).some(v => v !== null)
        if (hasAny) {
          return NextResponse.json({ bookmaker: bookmakerName, odds, source: 'exact' })
        }
      }
    }

    // Fallback: fetch all available bookmakers for this fixture, pick first with data
    const fallbackRes = await fetch(`${BASE}/odds?fixture=${fixtureId}`, {
      headers: { 'x-apisports-key': API_KEY },
    })
    const fallbackJson = await fallbackRes.json()
    const allBookmakers: any[] = fallbackJson.response?.[0]?.bookmakers || []

    if (allBookmakers.length === 0) {
      return NextResponse.json({ bookmaker: bookmakerName, odds: null, source: 'none' })
    }

    // Prefer the requested bookmaker by name if found
    const namedBk = allBookmakers.find(
      (b: any) => b.name?.toLowerCase().includes(bookmakerName.toLowerCase())
    )
    const bk = namedBk || allBookmakers[0]
    const odds = extractOdds(bk)
    const actualName = bk.name || bookmakerName

    return NextResponse.json({ bookmaker: actualName, odds, source: namedBk ? 'name-match' : 'fallback' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
