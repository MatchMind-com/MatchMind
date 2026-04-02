import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

// Returns the current football season year (e.g. April 2026 → 2025 for 2025/26 season)
function getCurrentSeason(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 8 ? year : year - 1
}

function getDatePlusDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

async function apiFetch(path: string) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.response || null
  } catch { return null }
}

const LEAGUE_NAMES: Record<string, string> = {
  '39': 'Premier League', '140': 'La Liga', '135': 'Serie A',
  '78': 'Bundesliga', '61': 'Ligue 1', '2': 'Champions League',
  '3': 'Europa League', '848': 'Conference League', '40': 'Championship',
  '88': 'Eredivisie', '94': 'Primeira Liga', '203': 'Süper Lig',
  '179': 'Scottish Premiership', '144': 'Belgian Pro League', '253': 'MLS',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, history = [], leagueId = '39' } = await req.json()
  const season = getCurrentSeason()
  const today = new Date().toISOString().split('T')[0]

  // Fetch user's bet history for context
  const { data: recentBets } = await supabase
    .from('bet_slips')
    .select('match_name, league, stake, odds, result, profit_loss, bet_type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(15)

  // Fetch rich football data in parallel (all cached 5 min)
  const [fixtures, liveGames, standings, topScorers, recentResults] = await Promise.all([
    apiFetch(`/fixtures?league=${leagueId}&season=${season}&from=${today}&to=${getDatePlusDays(7)}`),
    apiFetch(`/fixtures?live=all`),
    apiFetch(`/standings?league=${leagueId}&season=${season}`),
    apiFetch(`/players/topscorers?league=${leagueId}&season=${season}`),
    apiFetch(`/fixtures?league=${leagueId}&season=${season}&from=${getDatePlusDays(-7)}&to=${getDatePlusDays(-1)}&status=FT`),
  ])

  // Format upcoming fixtures (next 7 days, up to 15)
  const upcomingText = fixtures?.slice(0, 15).map((f: any) => {
    const home = f.teams?.home?.name
    const away = f.teams?.away?.name
    const date = new Date(f.fixture?.date).toLocaleString('en-GB', {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    const venue = f.fixture?.venue?.name
    return `• ${home} vs ${away} — ${date}${venue ? ` @ ${venue}` : ''}`
  }).join('\n') || 'No upcoming fixtures'

  // Format recent results (last 7 days, up to 10)
  const resultsText = recentResults?.slice(0, 10).map((f: any) => {
    const home = f.teams?.home?.name
    const away = f.teams?.away?.name
    const score = `${f.goals?.home ?? 0}-${f.goals?.away ?? 0}`
    const date = new Date(f.fixture?.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    return `• ${home} ${score} ${away} (${date})`
  }).join('\n') || 'No recent results'

  // Format live games (all leagues)
  const liveText = liveGames?.slice(0, 8).map((f: any) => {
    const home = f.teams?.home?.name
    const away = f.teams?.away?.name
    const score = `${f.goals?.home ?? 0}-${f.goals?.away ?? 0}`
    const minute = f.fixture?.status?.elapsed
    const league = f.league?.name
    return `• ${home} ${score} ${away} (${minute}') — ${league}`
  }).join('\n') || 'No live games right now'

  // Format standings (top 10)
  const standingsData = standings?.[0]?.league?.standings?.[0]?.slice(0, 10)
  const standingsText = standingsData?.map((t: any) =>
    `${t.rank}. ${t.team?.name} — P${t.all?.played} W${t.all?.win} D${t.all?.draw} L${t.all?.lose} GD${t.goalsDiff > 0 ? '+' : ''}${t.goalsDiff} Pts${t.points}`
  ).join('\n') || 'Standings unavailable'

  // Format top scorers (top 5)
  const scorersText = topScorers?.slice(0, 5).map((p: any) =>
    `${p.player?.name} (${p.statistics?.[0]?.team?.name}) — ${p.statistics?.[0]?.goals?.total} goals`
  ).join('\n') || 'Top scorers unavailable'

  // Format user bet history
  const betsText = recentBets?.map((b: any) =>
    `${b.match_name} | ${b.bet_type} @ ${b.odds} | £${b.stake} | ${b.result || 'Pending'}${b.profit_loss ? ` | P/L: £${b.profit_loss}` : ''}`
  ).join('\n') || 'No recent bets'

  const leagueName = LEAGUE_NAMES[leagueId] || 'Football'

  const systemPrompt = `You are BetIQ, an elite AI football betting coach with access to real-time data for the ${season}/${season + 1} season. You combine deep football intelligence with sharp statistical analysis to help users make smarter betting decisions.

=== LIVE FOOTBALL DATA — ${leagueName} (${season}/${String(season + 1).slice(2)} season) ===

📅 UPCOMING FIXTURES (next 7 days):
${upcomingText}

✅ RECENT RESULTS (last 7 days):
${resultsText}

🔴 LIVE RIGHT NOW (all leagues):
${liveText}

📊 CURRENT STANDINGS (Top 10):
${standingsText}

⚽ TOP SCORERS:
${scorersText}

=== USER'S BETTING PROFILE ===
Recent bets (last 15):
${betsText}

=== YOUR ROLE ===
- Reference specific upcoming matches by name and date when giving advice
- Use recent results and form to back up your analysis
- Mention top scorers when relevant to goalscoring markets
- Give concrete stake recommendations using Kelly Criterion principles
- Identify value bets — where odds are better than true probability
- Be direct: give a clear YES/NO/AVOID verdict on bets when asked
- Always highlight key risks and injury concerns
- Reference standings and league position when discussing team quality

Keep responses concise and actionable. Use emojis sparingly for clarity. Focus on quality over quantity.`

  const chatMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.slice(-8),
    { role: 'user' as const, content: message },
  ]

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: chatMessages,
    max_tokens: 700,
  })

  const reply = completion.choices[0]?.message?.content || 'Unable to generate response.'

  return NextResponse.json({
    reply,
    context: {
      liveCount: liveGames?.length || 0,
      upcomingCount: fixtures?.slice(0, 15).length || 0,
      recentResultsCount: recentResults?.slice(0, 10).length || 0,
      league: leagueName,
      season: `${season}/${String(season + 1).slice(2)}`,
    }
  })
}
