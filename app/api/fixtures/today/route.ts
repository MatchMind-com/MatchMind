import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE = 'https://v3.football.api-sports.io'

// Major leagues always shown (popular games)
const MAJOR_LEAGUES = [2, 3, 39, 140, 135, 78, 61, 848, 40]

// League name → API ID mapping (from onboarding labels)
const LEAGUE_NAME_TO_ID: Record<string, number> = {
  'Premier League': 39,
  'La Liga': 140,
  'Serie A': 135,
  'Bundesliga': 78,
  'Ligue 1': 61,
  'Champions League': 2,
  'Europa League': 3,
  'Conference League': 848,
  'Championship': 40,
  'Eredivisie': 88,
  'Primeira Liga': 94,
  'Süper Lig': 203,
  'Scottish Premiership': 179,
  'Belgian Pro League': 144,
  'MLS': 253,
}

const LEAGUE_ID_TO_NAME: Record<number, string> = {
  2: 'Champions League', 3: 'Europa League', 39: 'Premier League',
  140: 'La Liga', 135: 'Serie A', 78: 'Bundesliga', 61: 'Ligue 1',
  848: 'Conference League', 40: 'Championship', 88: 'Eredivisie',
  94: 'Primeira Liga', 203: 'Süper Lig', 179: 'Scottish Premiership',
  144: 'Belgian Pro League', 253: 'MLS',
}

const LEAGUE_COLORS: Record<number, string> = {
  2: '#0a2d6e', 39: '#3d0e5e', 140: '#c8a900', 135: '#003580',
  78: '#d30000', 61: '#003189', 848: '#1a5276', 40: '#5b1fa8',
  3: '#f47320', 88: '#e8001e', 94: '#006600', 203: '#c8001a',
}

function getCurrentSeason(): number {
  const now = new Date()
  return now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1
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

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get user's favourite leagues + team from onboarding
  const { data: prefs } = await supabase
    .from('user_preferences')
    .select('favourite_leagues, favourite_team')
    .eq('user_id', user.id)
    .single()

  const season = getCurrentSeason()
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const in3days = new Date(now.getTime() + 3 * 86400000).toISOString().split('T')[0]

  // Build set of league IDs to fetch (major + favourites)
  const leagueIds = new Set<number>(MAJOR_LEAGUES)
  // Add more leagues for broader coverage
  ;[88, 94, 203, 144, 113].forEach(id => leagueIds.add(id))
  if (prefs?.favourite_leagues) {
    for (const name of prefs.favourite_leagues) {
      const id = LEAGUE_NAME_TO_ID[name]
      if (id) leagueIds.add(id)
    }
  }

  // Fetch next 3 days of fixtures for all relevant leagues in parallel
  const fixturePromises = Array.from(leagueIds).map(id =>
    apiFetch(`/fixtures?league=${id}&season=${season}&from=${today}&to=${in3days}&status=NS-1H-2H-ET-HT-FT`)
  )
  const results = await Promise.all(fixturePromises)

  // Flatten and deduplicate
  const seen = new Set<number>()
  const fixtures: any[] = []
  const leagueArr = Array.from(leagueIds)

  results.forEach((leagueFixtures, i) => {
    if (!leagueFixtures) return
    const leagueId = leagueArr[i]
    leagueFixtures.forEach((f: any) => {
      if (seen.has(f.fixture?.id)) return
      seen.add(f.fixture?.id)
      const fixtureDate = f.fixture?.date?.split('T')[0]
      const dayLabel = fixtureDate === today ? 'Today'
        : fixtureDate === new Date(now.getTime() + 86400000).toISOString().split('T')[0] ? 'Tomorrow'
        : new Date(fixtureDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

      fixtures.push({
        id: f.fixture?.id,
        date: f.fixture?.date,
        matchDay: dayLabel,
        status: f.fixture?.status?.short,
        elapsed: f.fixture?.status?.elapsed,
        venue: f.fixture?.venue?.name,
        city: f.fixture?.venue?.city,
        home: {
          id: f.teams?.home?.id,
          name: f.teams?.home?.name,
          logo: f.teams?.home?.logo,
        },
        away: {
          id: f.teams?.away?.id,
          name: f.teams?.away?.name,
          logo: f.teams?.away?.logo,
        },
        score: {
          home: f.goals?.home,
          away: f.goals?.away,
        },
        league: {
          id: leagueId,
          name: f.league?.name || LEAGUE_ID_TO_NAME[leagueId],
          logo: f.league?.logo,
          color: LEAGUE_COLORS[leagueId] || '#1e3a5f',
        },
        isFavouriteLeague: prefs?.favourite_leagues?.some(
          (name: string) => LEAGUE_NAME_TO_ID[name] === leagueId
        ) || false,
        isFavouriteTeam:
          prefs?.favourite_team &&
          (f.teams?.home?.name?.toLowerCase().includes(prefs.favourite_team.toLowerCase()) ||
           f.teams?.away?.name?.toLowerCase().includes(prefs.favourite_team.toLowerCase())),
      })
    })
  })

  // Sort: favourite team first, then favourite leagues, then by kickoff time
  fixtures.sort((a, b) => {
    if (a.isFavouriteTeam && !b.isFavouriteTeam) return -1
    if (!a.isFavouriteTeam && b.isFavouriteTeam) return 1
    if (a.isFavouriteLeague && !b.isFavouriteLeague) return -1
    if (!a.isFavouriteLeague && b.isFavouriteLeague) return 1
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  return NextResponse.json({
    fixtures,
    favouriteTeam: prefs?.favourite_team || null,
    date: today,
  })
}
