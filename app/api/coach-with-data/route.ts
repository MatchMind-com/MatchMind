import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

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

function getDatePlusDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, history = [], leagueId = '39' } = await req.json()

  // Fetch user's bet history for context
  const { data: recentBets } = await supabase
    .from('bet_slips')
    .select('match_name, league, stake, odds, result, profit_loss, bet_type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Fetch live football data in parallel
  const today = new Date().toISOString().split('T')[0]
  const [fixtures, liveGames, standings] = await Promise.all([
    apiFetch(`/fixtures?league=${leagueId}&season=2024&from=${today}&to=${getDatePlusDays(3)}`),
    apiFetch(`/fixtures?live=all`),
    apiFetch(`/standings?league=${leagueId}&season=2024`),
  ])

  // Format fixtures context
  const upcomingText = fixtures?.slice(0, 8).map((f: any) => {
    const home = f.teams?.home?.name
    const away = f.teams?.away?.name
    const date = new Date(f.fixture?.date).toLocaleString('en-GB', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    const venue = f.fixture?.venue?.name
    return `• ${home} vs ${away} — ${date}${venue ? ` @ ${venue}` : ''}`
  }).join('\n') || 'No upcoming fixtures available'

  // Format live games
  const liveText = liveGames?.slice(0, 5).map((f: any) => {
    const home = f.teams?.home?.name
    const away = f.teams?.away?.name
    const score = `${f.goals?.home ?? 0}-${f.goals?.away ?? 0}`
    const minute = f.fixture?.status?.elapsed
    return `• ${home} ${score} ${away} (${minute}')`
  }).join('\n') || 'No live games right now'

  // Format standings
  const standingsData = standings?.[0]?.league?.standings?.[0]?.slice(0, 6)
  const standingsText = standingsData?.map((t: any) =>
    `${t.rank}. ${t.team?.name} — P${t.all?.played} W${t.all?.win} D${t.all?.draw} L${t.all?.lose} GD${t.goalsDiff} Pts${t.points}`
  ).join('\n') || 'Standings unavailable'

  // Format user bet history
  const betsText = recentBets?.map((b: any) =>
    `${b.match_name} | ${b.bet_type} @ ${b.odds} | £${b.stake} | ${b.result || 'Pending'}${b.profit_loss ? ` | P/L: £${b.profit_loss}` : ''}`
  ).join('\n') || 'No recent bets'

  const leagueNames: Record<string, string> = {
    '39': 'Premier League', '140': 'La Liga', '135': 'Serie A',
    '78': 'Bundesliga', '61': 'Ligue 1', '2': 'Champions League',
    '3': 'Europa League',
  }

  const systemPrompt = `You are BetIQ, an elite AI football betting coach with access to real-time data. You combine deep football intelligence with sharp statistical analysis to help users make smarter betting decisions.

=== LIVE FOOTBALL DATA (${leagueNames[leagueId] || 'Football'}) ===

📅 UPCOMING FIXTURES (next 3 days):
${upcomingText}

🔴 LIVE RIGHT NOW:
${liveText}

📊 CURRENT STANDINGS (Top 6):
${standingsText}

=== USER'S BETTING PROFILE ===
Recent bets:
${betsText}

=== YOUR ROLE ===
- Reference specific upcoming matches when giving advice
- Mention team form, injury concerns, and head-to-head when relevant
- Give concrete stake recommendations using Kelly Criterion principles
- Identify value bets — where odds are better than true probability
- Be direct: give a clear YES/NO/AVOID verdict on bets when asked
- Always highlight key risks

Keep responses concise and actionable. Use emojis sparingly for clarity. Focus on quality over quantity.`

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.slice(-8),
    { role: 'user' as const, content: message },
  ]

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    max_tokens: 600,
  })

  const reply = completion.choices[0]?.message?.content || 'Unable to generate response.'

  return NextResponse.json({
    reply,
    context: {
      liveCount: liveGames?.length || 0,
      upcomingCount: fixtures?.slice(0, 8).length || 0,
      league: leagueNames[leagueId] || 'Football',
    }
  })
}
