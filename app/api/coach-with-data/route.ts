import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { retrieveMemories, saveMemory } from '@/lib/memory-lane'
import { getUserContext, renderContextBlock } from '@/lib/user-context'
import { leaguesPromptBlock, findLeague, TRACKED_LEAGUES } from '@/lib/leagues'
import { parseBetRec, BET_REC_PROMPT_INSTRUCTIONS } from '@/lib/parse-bet-rec'
import { detectTeams } from '@/lib/team-resolver'
import { getTeamDeepData, renderDeepDataBlock } from '@/lib/team-deep-data'
import {
  evaluatePick,
  fetchFixturesForDates,
  matchFixture,
  parseAccaLegs,
  shiftDate,
} from '@/lib/live-bet-evaluator'

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
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.response || null
  } catch { return null }
}

// League names now come from lib/leagues.ts via findLeague() so all 25
// tracked competitions are covered (not just the Tier-1 / 2 subset).

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, history = [], leagueId = '39' } = await req.json()
  const season = getCurrentSeason()
  const today = new Date().toISOString().split('T')[0]

  // Fetch user's bet history + currently pending bets + preferences + AI's
  // pre-computed predictions in parallel. The pending bets fuel the coach's
  // awareness of "my bet today" so the user can ask "where's it played",
  // "who's injured", etc., and get specific answers.
  const [{ data: recentBets }, { data: pendingBetsRaw }, { data: userPrefs }, { data: predictionRows }] = await Promise.all([
    supabase
      .from('bet_slips')
      .select('match_name, league, stake, odds, result, profit_loss, bet_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('bet_slips')
      .select('id, match_name, league, bet_type, selection, odds, stake, match_date, bookmaker, notes')
      .eq('user_id', user.id)
      .eq('result', 'pending')
      .order('match_date', { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from('user_preferences')
      .select('favourite_team, lucky_charm_team, favourite_leagues, betting_experience, monthly_pl_estimate, preferred_bet_types')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('predictions_by_league')
      .select('league_name, payload, generated_at')
      .order('generated_at', { ascending: false }),
  ])

  // Fetch rich football data in parallel (all cached 60s)
  // Today's fixtures fetched ACROSS ALL LEAGUES (not just the active one) so the
  // coach can answer "what's today" without picking a single league first.
  const [todayAll, fixtures, liveGames, standings, topScorers, recentResults, injuries] = await Promise.all([
    apiFetch(`/fixtures?date=${today}`),
    apiFetch(`/fixtures?league=${leagueId}&season=${season}&from=${today}&to=${getDatePlusDays(7)}`),
    apiFetch(`/fixtures?live=all`),
    apiFetch(`/standings?league=${leagueId}&season=${season}`),
    apiFetch(`/players/topscorers?league=${leagueId}&season=${season}`),
    apiFetch(`/fixtures?league=${leagueId}&season=${season}&from=${getDatePlusDays(-7)}&to=${getDatePlusDays(-1)}&status=FT`),
    apiFetch(`/injuries?league=${leagueId}&season=${season}&date=${today}`),
  ])

  // TRACKED league IDs — only show fixtures for leagues we actually cover.
  // Derived from lib/leagues.ts so adding a league there auto-includes it
  // in the today's-matches block here.
  const TRACKED_IDS = new Set(TRACKED_LEAGUES.map(l => l.id))

  // Today's fixtures across all tracked leagues — sort by kickoff time
  const todayFiltered = (todayAll || [])
    .filter((f: any) => TRACKED_IDS.has(f.league?.id))
    .filter((f: any) => ['NS','TBD','1H','HT','2H','ET','BT','P','LIVE'].includes(f.fixture?.status?.short))
    .sort((a: any, b: any) => new Date(a.fixture?.date).getTime() - new Date(b.fixture?.date).getTime())
    .slice(0, 25)

  const todayText = todayFiltered.map((f: any) => {
    const home = f.teams?.home?.name
    const away = f.teams?.away?.name
    const time = new Date(f.fixture?.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const lge = f.league?.name
    const status = f.fixture?.status?.short === 'NS' ? `${time} KO` : `${f.fixture?.status?.short} · ${f.goals?.home ?? 0}-${f.goals?.away ?? 0}`
    return `• ${home} vs ${away} — ${lge} · ${status}`
  }).join('\n') || 'No tracked-league matches today'

  // Flatten all the AI's pre-computed value picks across all tracked leagues,
  // take the best by EV/value_score. The AI MUST recommend from these — they
  // have real fixture IDs, real odds, and proven +EV. No more "wait for odds
  // to be released" excuses.
  const allPicks: any[] = []
  for (const row of (predictionRows || [])) {
    const arr = Array.isArray(row.payload) ? row.payload : []
    for (const p of arr) {
      if (p?.is_value_bet && p?.best_value && p?.id) {
        const ko = p.date ? new Date(p.date) : null
        const isFuture = ko && ko.getTime() > Date.now()
        if (isFuture) {
          allPicks.push({ ...p, _leagueName: row.league_name })
        }
      }
    }
  }
  allPicks.sort((a, b) => (b.value_score ?? b.best_value?.ev ?? 0) - (a.value_score ?? a.best_value?.ev ?? 0))
  const topPicks = allPicks.slice(0, 12)
  const aiPicksText = topPicks.map((p: any) => {
    const home = p.home_team
    const away = p.away_team
    const ko = p.date ? new Date(p.date).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBC'
    const bv = p.best_value
    const conf = p.confidence ?? '?'
    const reason = p.edge_explanation ? ` — ${p.edge_explanation}` : ''
    return `• ${home} vs ${away} (${p._leagueName}, ${ko}) | PICK: ${bv.label} @ ${bv.odds} | EV: +${bv.ev}% | confidence ${conf}/10 | fixtureId: ${p.id}${reason}`
  }).join('\n') || 'No +EV picks computed yet — refresh the predictions cron.'

  // Format upcoming fixtures (next 7 days, up to 15) — for the active league
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

  // Format injury report (group by team)
  const injuryByTeam: Record<string, string[]> = {}
  injuries?.forEach((inj: any) => {
    const team = inj.team?.name
    const player = inj.player?.name
    const reason = inj.player?.reason
    if (team && player) {
      if (!injuryByTeam[team]) injuryByTeam[team] = []
      injuryByTeam[team].push(`${player}${reason ? ` (${reason})` : ''}`)
    }
  })
  const injuryText = Object.entries(injuryByTeam).slice(0, 8)
    .map(([team, players]) => `${team}: ${players.join(', ')}`)
    .join('\n') || 'No injury data available'

  // Format user bet history
  const betsText = recentBets?.map((b: any) =>
    `${b.match_name} | ${b.bet_type} @ ${b.odds} | £${b.stake} | ${b.result || 'Pending'}${b.profit_loss ? ` | P/L: £${b.profit_loss}` : ''}`
  ).join('\n') || 'No recent bets'

  const leagueName = findLeague(leagueId)?.name || 'Football'

  // ── USER'S ACTIVE PENDING BETS ────────────────────────────────────────
  // Flatten singles + acca legs into a unified list. Every leg is an
  // "active item" with team names, league, kickoff date, etc. Used both
  // for (a) injecting an "ACTIVE BETS" block in the system prompt and
  // (b) seeding the deep-team-data fetcher so the coach automatically
  // has injury/form/venue intel on the teams the user is betting on.
  type ActiveItem = {
    source: 'single' | 'acca'
    parentId?: string
    matchName: string
    league?: string | null
    matchDate?: string | null
    selection: string
    betType?: string | null
    odds: number
    stake?: number | null
    bookmaker?: string | null
    fixture?: any | null
    venue?: string | null
    venueCity?: string | null
    kickoff?: string | null
    // Live enrichment
    liveStatus?: string | null  // NS / 1H / 2H / FT / etc.
    liveMinute?: number | null
    liveScore?: string | null   // "1-3"
    pickState?: string | null   // cashing / losing / won / lost / pending
    pickLabel?: string | null   // "Won", "Behind", "Cashing"
    pickContext?: string | null // "Both teams scored"
  }
  const activeItems: ActiveItem[] = []
  for (const bet of pendingBetsRaw ?? []) {
    const legs = parseAccaLegs(bet.notes)
    if (legs && legs.length > 1) {
      for (const leg of legs) {
        activeItems.push({
          source: 'acca',
          parentId: bet.id,
          matchName: leg.match_name,
          league: leg.league ?? null,
          matchDate: leg.match_date ?? null,
          selection: leg.selection,
          betType: leg.bet_type ?? null,
          odds: leg.odds,
          stake: bet.stake,
          bookmaker: bet.bookmaker ?? null,
        })
      }
    } else if (bet.match_name) {
      activeItems.push({
        source: 'single',
        matchName: bet.match_name,
        league: bet.league ?? null,
        matchDate: bet.match_date ?? null,
        selection: bet.selection ?? '',
        betType: bet.bet_type ?? null,
        odds: bet.odds ?? 0,
        stake: bet.stake,
        bookmaker: bet.bookmaker ?? null,
      })
    }
  }

  // Enrich each active item with venue + kickoff time by looking up the
  // fixture in API-Football. Group by date to keep API calls minimal.
  if (activeItems.length > 0) {
    const datesNeeded = new Set<string>()
    for (const it of activeItems) {
      if (it.matchDate) datesNeeded.add(it.matchDate.slice(0, 10))
    }
    if (datesNeeded.size > 0) {
      try {
        const fixturesByDate = await fetchFixturesForDates(datesNeeded)
        for (const it of activeItems) {
          const date = it.matchDate?.slice(0, 10)
          if (!date) continue
          const fxs = [
            ...(fixturesByDate.get(date) ?? []),
            ...(fixturesByDate.get(shiftDate(date, -1)) ?? []),
            ...(fixturesByDate.get(shiftDate(date, 1)) ?? []),
          ]
          const fx = matchFixture(fxs, it.matchName)
          if (fx) {
            it.fixture = fx
            it.venue = fx?.fixture?.venue?.name ?? null
            it.venueCity = fx?.fixture?.venue?.city ?? null
            it.kickoff = fx?.fixture?.date ?? null
            // Live enrichment so the coach can answer "what's the score
            // for my first leg?" — covers FT games (which would otherwise
            // drop out of the global LIVE block) AND in-play games.
            it.liveStatus = fx?.fixture?.status?.short ?? null
            it.liveMinute = fx?.fixture?.status?.elapsed ?? null
            const hg = fx?.goals?.home
            const ag = fx?.goals?.away
            if (hg != null && ag != null) it.liveScore = `${hg}-${ag}`
            // Grade the pick against current state — same evaluator the
            // money page uses, so coach + UI agree on every leg.
            try {
              const ev = evaluatePick(it.selection ?? '', it.betType ?? null, fx)
              it.pickState = ev.state
              it.pickLabel = ev.label
              it.pickContext = ev.context ?? null
            } catch {
              // Best-effort — leave pickState null on errors.
            }
          }
        }
      } catch (e) {
        console.warn('[coach-with-data] active-bet fixture lookup failed:', e)
      }
    }
  }

  // Build the "MY ACTIVE BETS" prompt block.
  // Format the live status line for each active item. This is the bit
  // that lets the coach answer "what's the score for my Saudi game?"
  // even when the game is FT and dropped out of the global LIVE block.
  function liveLine(it: ActiveItem): string | null {
    if (!it.liveStatus) return null
    const FINISHED = ['FT', 'AET', 'PEN']
    const IN_PLAY = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE']
    let statusText: string
    if (FINISHED.includes(it.liveStatus)) {
      statusText = it.liveStatus === 'FT' ? 'FT' : it.liveStatus
    } else if (IN_PLAY.includes(it.liveStatus)) {
      statusText = `LIVE ${it.liveMinute ?? ''}'`
    } else if (it.liveStatus === 'NS' || it.liveStatus === 'TBD') {
      statusText = 'Not started'
    } else {
      statusText = it.liveStatus
    }
    const score = it.liveScore ? ` · score ${it.liveScore}` : ''
    const grade = it.pickLabel
      ? ` · pick is ${it.pickLabel.toUpperCase()}${it.pickContext ? ` (${it.pickContext})` : ''}`
      : ''
    return `Status: ${statusText}${score}${grade}`
  }

  const myBetsBlock = activeItems.length > 0
    ? `\n=== USER'S CURRENT ACTIVE BETS (still pending — answer questions about THESE specifically, with LIVE scores) ===
${activeItems.map((it, i) => {
        const tag = it.source === 'acca' ? `[Acca leg]` : `[Single]`
        const venue = it.venue ? `${it.venue}${it.venueCity ? ', ' + it.venueCity : ''}` : null
        const kickoff = it.kickoff ? new Date(it.kickoff).toUTCString().replace(' GMT', ' UTC') : (it.matchDate ?? 'TBC')
        const live = liveLine(it)
        return `${i + 1}. ${tag} ${it.matchName}${it.league ? ` · ${it.league}` : ''}
   Pick: ${it.betType ? it.betType + ' — ' : ''}${it.selection} @ ${it.odds.toFixed(2)}${it.stake ? ` · stake ${it.stake}u` : ''}${it.bookmaker ? ` · ${it.bookmaker}` : ''}
   Kickoff: ${kickoff}${venue ? ` · Venue: ${venue}` : ''}${live ? '\n   ' + live : ''}`
      }).join('\n\n')}

When the user asks about "my bet" / "my acca" / "is my bet alive" / "what's the score for my X" / "who's winning my pick" — answer DIRECTLY from the Status lines above, even if the game is finished (FT). The Status field always reflects the latest score and grades the pick as WON / LOST / CASHING / BEHIND / NOT STARTED. Never say "I don't know the score" if a Status line exists for that bet. For injury / form / lineup detail, relevant teams are pre-loaded in the DEEP DATA block below.\n`
    : ''

  // ── DEEP TEAM DATA ────────────────────────────────────────────────────
  // Collect team names for deep-data fetch from BOTH the user's message
  // AND the teams in their pending bets. So when they ask "who's injured?"
  // about a bet they made, the injury data is already loaded.
  const activeLeagueIdNum = parseInt(String(leagueId), 10) || 39
  let deepDataBlock = ''
  try {
    const messageTeams = await detectTeams(message)
    // Build a synthetic "text" containing all active-bet team names so we
    // can re-use the fast local detector. Cap to keep fan-out bounded.
    const betTeamsText = activeItems
      .slice(0, 8)
      .map((it) => it.matchName)
      .join(' . ')
    const betTeams = betTeamsText ? await detectTeams(betTeamsText) : []
    // Merge + dedupe by id, cap at 4 teams (3 message + 1 from bets, or vice versa).
    const seen = new Set<number>()
    const merged: typeof messageTeams = []
    for (const t of [...messageTeams, ...betTeams]) {
      if (seen.has(t.id)) continue
      seen.add(t.id)
      merged.push(t)
      if (merged.length >= 4) break
    }
    if (merged.length > 0) {
      const deepData = await Promise.all(
        merged.map(t =>
          getTeamDeepData(t.id, t.leagueId ?? activeLeagueIdNum).catch(() => null),
        ),
      )
      const blocks = deepData
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .map(renderDeepDataBlock)
      if (blocks.length > 0) {
        deepDataBlock =
          '\n=== TEAM-SPECIFIC DEEP DATA (fetched on demand for teams the user mentioned + teams in their active bets) ===\n' +
          blocks.join('\n\n') +
          '\n\nWhen you see a 🔬 DEEP DATA block above for a team, use it as the AUTHORITATIVE source for that team\'s form, injuries, fixtures, and stats. Reference specific players and numbers from it — never contradict it with training-data guesses.\n'
      }
    }
  } catch (e) {
    console.warn('[coach-with-data] deep team data failed:', e)
  }

  // Unified user context — bankroll + goal + recent bets + loss streak.
  // Best-effort; falls back to empty block on any failure.
  let financialContextBlock = ''
  try {
    const userCtx = await getUserContext(user.id, message)
    financialContextBlock = renderContextBlock(userCtx)
  } catch (e) {
    console.warn('[coach-with-data] user context failed:', e)
  }

  // Memory Lane — retrieve relevant past memories (best-effort, never blocks)
  const memories = await retrieveMemories(supabase as any, user.id, message, 5)
  const memoryText = memories.length
    ? memories
        .map((m, i) => `${i + 1}. (${m.role}) "${m.content.slice(0, 240)}"`)
        .join('\n')
    : ''
  const memoryBlock = memoryText
    ? `\n=== WHAT YOU REMEMBER ABOUT THIS USER (from past conversations) ===\n${memoryText}\nReference these naturally when relevant — it shows you remember them. Never list them back robotically.\n`
    : ''

  // Build personalisation context from onboarding preferences
  const personalisation = userPrefs ? `
=== USER PROFILE (personalised from onboarding) ===
- Favourite team: ${userPrefs.favourite_team || 'Not set'}
- Lucky charm team: ${userPrefs.lucky_charm_team || 'Not set'}
- Preferred leagues: ${userPrefs.favourite_leagues?.join(', ') || 'Not set'}
- Betting experience: ${userPrefs.betting_experience || 'Not set'}
- Monthly P&L: ${userPrefs.monthly_pl_estimate || 'Not set'}
- Preferred bet types: ${userPrefs.preferred_bet_types?.join(', ') || 'Not set'}

Adjust your coaching tone to this profile: ${
    userPrefs.betting_experience === 'beginner' ? 'Explain concepts clearly, avoid jargon, encourage good habits.' :
    userPrefs.betting_experience === 'casual' ? 'Be friendly and informative, no need for over-explanation.' :
    userPrefs.betting_experience === 'serious' ? 'Be analytical and data-focused. Skip basics.' :
    userPrefs.betting_experience === 'professional' ? 'Be concise and highly technical. EV, Kelly Criterion, market movements.' :
    'Be balanced and helpful.'
  }
${userPrefs.monthly_pl_estimate === 'losing' ? 'This user is net losing — prioritise stake management and identifying leaks.' : ''}
${userPrefs.monthly_pl_estimate === 'consistent_profit' ? 'This user is profitable — focus on maximising EV and scaling intelligently.' : ''}
` : ''

  const systemPrompt = `You are MatchMind, an elite AI football betting coach with access to real-time data for the ${season}/${season + 1} season. You combine deep football intelligence with sharp statistical analysis to help users make smarter betting decisions.

=== LEAGUES YOU COVER ===
${leaguesPromptBlock()}

${BET_REC_PROMPT_INSTRUCTIONS}
${myBetsBlock}${financialContextBlock ? `\n${financialContextBlock}\n` : ''}${personalisation}${memoryBlock}${deepDataBlock}
=== LIVE FOOTBALL DATA — ${leagueName} (${season}/${String(season + 1).slice(2)} season) ===

📅 TODAY'S MATCHES (across ALL ${TRACKED_LEAGUES.length} tracked leagues — kicks off today, ${today}):
${todayText}

📅 UPCOMING FIXTURES — ${leagueName} (next 7 days):
${upcomingText}

🎯 MATCHMIND'S CURRENT VALUE PICKS (pre-computed by the daily prediction pipeline — these are the bets the AI has already identified as +EV across all ${TRACKED_LEAGUES.length} tracked leagues. WHEN THE USER ASKS FOR A BET RECOMMENDATION, RECOMMEND FROM THIS LIST FIRST — these have real odds, real edges, and exact fixture IDs):
${aiPicksText}

✅ RECENT RESULTS (last 7 days):
${resultsText}

🔴 LIVE RIGHT NOW (all leagues):
${liveText}

📊 CURRENT STANDINGS (Top 10):
${standingsText}

⚽ TOP SCORERS:
${scorersText}

🚑 INJURY REPORT (${leagueName}):
${injuryText}

=== USER'S BETTING PROFILE ===
Recent bets (last 15):
${betsText}

=== YOUR ROLE ===
- ABSOLUTE RULE — questions about "my bet", "my acca", "my pick", "my slip", "where is it played", "what time", "who's playing", "is my bet alive", "what's the score for my X", "how is my X doing", "who's injured for [team]", "which stadium" — answer SPECIFICALLY from the USER'S CURRENT ACTIVE BETS block above. Each active bet has a Status line with live score + pick grade (WON / LOST / CASHING / BEHIND / NOT STARTED) — quote it directly. Use the venue, kickoff, league exactly as listed. For player injuries / recent form / lineups, reference the DEEP DATA block which has the relevant teams pre-loaded.
- Reference specific upcoming matches by name and date when giving advice
- When the user asks about "today" or "tonight" specifically — recommend matches from the TODAY'S MATCHES block ONLY. Don't suggest tomorrow/Saturday matches if they asked about today.
- ABSOLUTE RULE: When the user asks "what's the best bet" / "value bets" / "should I bet on X" / "find me a bet" — you MUST recommend a SPECIFIC pick from MATCHMIND'S CURRENT VALUE PICKS list above. Each entry has a real fixture, real odds, real EV, and a fixtureId. Pick the highest-EV one that matches the user's filter (today / specific league / specific market) and emit a [BET_REC] block with its exact data: home, away, market, selection, odds, league, kickoff (the date shown), fixtureId. Never say "wait for odds to be released" — the picks are right there with odds.
- If MATCHMIND'S CURRENT VALUE PICKS is empty, then say "the prediction pipeline hasn't run yet today — try again in a few minutes" instead of making up vague advice.
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

  const rawReply = completion.choices[0]?.message?.content || 'Unable to generate response.'

  // Strip the [BET_REC]…[/BET_REC] machine-token (if any) from the visible
  // text and parse it into a structured recommendation the UI can render
  // as an "Add to my bets" button.
  const { cleanText: reply, betRec: betRecommendation } = parseBetRec(rawReply)

  // Persist both sides of the exchange (fire-and-forget, never blocks response).
  // Save the CLEAN text (without the token) so it doesn't pollute future
  // memory retrievals.
  Promise.allSettled([
    saveMemory(supabase as any, user.id, message, 'user'),
    saveMemory(supabase as any, user.id, reply, 'assistant'),
  ]).catch(() => {})

  return NextResponse.json({
    reply,
    betRecommendation,
    context: {
      liveCount: liveGames?.length || 0,
      upcomingCount: fixtures?.slice(0, 15).length || 0,
      recentResultsCount: recentResults?.slice(0, 10).length || 0,
      league: leagueName,
      season: `${season}/${String(season + 1).slice(2)}`,
      memoriesUsed: memories.length,
    }
  })
}
