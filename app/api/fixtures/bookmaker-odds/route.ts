import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

const BOOKMAKER_IDS: Record<string, number> = {
  'Bet365':       8,
  'William Hill': 9,
  'Betfair':      13,
  'Paddy Power':  23,
  'Ladbrokes':    4,
  'Coral':        12,
  'Unibet':       5,
  'Sky Bet':      10,
  'Betway':       11,
  'BoyleSports':  32,
  'Pinnacle':     29,
  '888sport':     22,
  'Betfred':      25,
  'Bwin':         6,
}

// Map bet name → display category
function categorise(betName: string): string {
  const n = betName.toLowerCase()
  if (n.includes('winner') || n.includes('1x2') || n.includes('match result') || n.includes('double chance') || n.includes('draw no bet') || n.includes('win to nil') || n.includes('clean sheet')) return 'Match Result'
  if (n.includes('corner')) return 'Corners'
  if (n.includes('card') || n.includes('booking')) return 'Cards'
  if (n.includes('half') && (n.includes('over') || n.includes('under') || n.includes('goal'))) return 'Half Time Goals'
  if (n.includes('half') || n.includes('ht/ft') || n.includes('halftime')) return 'Half Time'
  if ((n.includes('over') || n.includes('under')) && (n.includes('goal') || n.includes('total'))) return 'Goals Over/Under'
  if (n.includes('both teams') || n.includes('btts') || n.includes('gg/ng')) return 'Both Teams Score'
  if (n.includes('correct score') || n.includes('exact score')) return 'Correct Score'
  if (n.includes('goalscorer') || n.includes('scorer') || n.includes('anytime')) return 'Goalscorers'
  if (n.includes('handicap')) return 'Handicap'
  if (n.includes('odd') || n.includes('even')) return 'Totals'
  if (n.includes('first') && (n.includes('team') || n.includes('goal'))) return 'First Goal'
  return 'Other'
}

function parseBookmaker(bk: any): { category: string; name: string; selections: { label: string; odds: number }[] }[] {
  const markets: { category: string; name: string; selections: { label: string; odds: number }[] }[] = []
  for (const bet of (bk?.bets || [])) {
    const selections = (bet.values || [])
      .map((v: any) => ({ label: String(v.value), odds: parseFloat(v.odd) }))
      .filter((s: any) => s.odds > 1)
    if (selections.length === 0) continue
    markets.push({
      category: categorise(bet.name),
      name: bet.name,
      selections,
    })
  }
  return markets
}

async function fetchOdds(fixtureId: string, bookmakerId?: number) {
  const url = bookmakerId
    ? `${BASE}/odds?fixture=${fixtureId}&bookmaker=${bookmakerId}`
    : `${BASE}/odds?fixture=${fixtureId}`
  const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY } })
  const json = await res.json()
  return json.response?.[0]?.bookmakers || []
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fixtureId = searchParams.get('fixtureId')
  const bookmakerName = searchParams.get('bookmaker') || ''

  if (!fixtureId) return NextResponse.json({ error: 'fixtureId required' }, { status: 400 })

  try {
    const bookmakerId = BOOKMAKER_IDS[bookmakerName]

    // Try exact bookmaker ID first
    if (bookmakerId) {
      const bookmakers = await fetchOdds(fixtureId, bookmakerId)
      const bk = bookmakers[0]
      if (bk) {
        const markets = parseBookmaker(bk)
        if (markets.length > 0) {
          return NextResponse.json({ bookmaker: bk.name || bookmakerName, markets, source: 'exact' })
        }
      }
    }

    // Fallback: all bookmakers, prefer name match
    const bookmakers = await fetchOdds(fixtureId)
    if (bookmakers.length === 0) {
      return NextResponse.json({ bookmaker: bookmakerName, markets: [], source: 'none' })
    }
    const named = bookmakers.find((b: any) =>
      b.name?.toLowerCase().includes(bookmakerName.toLowerCase())
    )
    const bk = named || bookmakers[0]
    const markets = parseBookmaker(bk)

    return NextResponse.json({
      bookmaker: bk.name || bookmakerName,
      markets,
      source: named ? 'name-match' : 'fallback',
      actualBookmaker: bk.name,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
