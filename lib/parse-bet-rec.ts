/**
 * Parses the [BET_REC]…[/BET_REC] token that AI routes ask GPT-4o to append
 * whenever it recommends a SPECIFIC bet (real match, real market, real odds).
 *
 * The token wraps a JSON payload like:
 *   [BET_REC]{"home":"Arsenal","away":"Atletico","market":"BTTS","selection":"Yes","odds":1.85,"stake":4.50,"league":"Champions League","kickoff":"2026-04-29T19:00:00Z","reasoning":"Both attack-heavy"}[/BET_REC]
 *
 * Returns:
 *   - `cleanText`: the AI's natural-language reply with the token stripped out.
 *   - `betRec`: the parsed JSON, or `null` if no valid token was found.
 *
 * Defensive parsing — survives:
 *   - multi-line JSON inside the token
 *   - escaped quotes in string fields
 *   - trailing whitespace / blank lines around the token
 *   - malformed JSON (returns `null`, never throws)
 *   - the AI emitting the token in the middle of the message instead of at the end
 */

export type BetRecommendation = {
  home: string | null
  away: string | null
  market: string | null
  selection: string | null
  odds: number | null
  stake: number | null
  league: string | null
  kickoff: string | null
  reasoning: string | null
  fixtureId?: number | null
}

const TOKEN_RE = /\[BET_REC\]([\s\S]*?)\[\/BET_REC\]/

export function parseBetRec(text: string): {
  cleanText: string
  betRec: BetRecommendation | null
} {
  if (!text || typeof text !== 'string') {
    return { cleanText: text || '', betRec: null }
  }

  const match = text.match(TOKEN_RE)
  if (!match) {
    return { cleanText: text, betRec: null }
  }

  // Strip the entire token (including any blank line it sat on its own).
  const cleanText = text.replace(TOKEN_RE, '').replace(/\n{3,}/g, '\n\n').trim()

  const rawJson = match[1].trim()
  let parsed: any = null
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    // GPT sometimes emits trailing commas or smart quotes — try light cleanup.
    try {
      const cleaned = rawJson
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
      parsed = JSON.parse(cleaned)
    } catch {
      // Truly malformed — drop the rec, but keep the cleaned text.
      return { cleanText, betRec: null }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { cleanText, betRec: null }
  }

  // Coerce + defensively normalise every field. Missing fields become null.
  const toStr = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const toNum = (v: any) => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = parseFloat(v)
      return Number.isFinite(n) ? n : null
    }
    return null
  }

  const betRec: BetRecommendation = {
    home: toStr(parsed.home),
    away: toStr(parsed.away),
    market: toStr(parsed.market),
    selection: toStr(parsed.selection),
    odds: toNum(parsed.odds),
    stake: toNum(parsed.stake),
    league: toStr(parsed.league),
    kickoff: toStr(parsed.kickoff),
    reasoning: toStr(parsed.reasoning),
    fixtureId: toNum(parsed.fixtureId ?? parsed.fixture_id),
  }

  // Minimal viability check — we need at least the two teams (or a match name)
  // and odds. Otherwise the rec is too weak to render an "Add to my bets" button.
  const hasMatch = (betRec.home && betRec.away) || betRec.selection
  if (!hasMatch || !betRec.odds || betRec.odds <= 1) {
    return { cleanText, betRec: null }
  }

  return { cleanText, betRec }
}

/**
 * The exact instruction block to inject into AI system prompts, telling
 * GPT-4o WHEN and HOW to emit the [BET_REC] token. Keep this as a single
 * source of truth so all three AI routes give identical guidance.
 */
export const BET_REC_PROMPT_INSTRUCTIONS = `
=== ACTIONABLE BET RECOMMENDATIONS ===
WHEN — and ONLY when — you are recommending a SPECIFIC bet on a real upcoming or live fixture (real teams, a real market, a real numeric odds price you can quote), append this token at the END of your response, after the natural-language reply:

[BET_REC]{"home":"Arsenal","away":"Atletico","market":"BTTS","selection":"Yes","odds":1.85,"stake":4.50,"league":"UEFA Champions League","kickoff":"2026-04-29T19:00:00Z","reasoning":"both attack-heavy and clean sheets rare"}[/BET_REC]

Field rules:
- home / away: full team names exactly as they appear in the fixture data
- market: one of "Match Winner", "BTTS", "Over 2.5", "Under 2.5", "Double Chance", "Asian Handicap", "Correct Score", or similar standard market names
- selection: the side/value being backed — "Home", "Away", "Draw", "Yes", "No", "Over", "Under", a scoreline, etc.
- odds: numeric decimal odds (e.g. 1.85, 2.40). Must be > 1.
- stake: a sensible suggested stake in the user's currency (use the bankroll/stake-sizing hint above if you have one; otherwise pick something between 1 and 5 percent of bankroll, capped at 2 units if no bankroll info)
- league: the competition name from the tracked-leagues list above
- kickoff: ISO 8601 timestamp of kick-off if known, else null
- reasoning: ONE short sentence (≤ 14 words) summarising the edge

DO emit the token when:
- The user explicitly asks "should I bet on X?" and you say yes
- You proactively spot a value bet in the upcoming fixtures and recommend it
- The user asks for "your best pick today" / "what's a good bet?"

DO NOT emit the token when:
- You're giving general advice ("stake less", "stick to value", "avoid accas")
- You're just reading out odds without recommending a bet
- The match or odds are hypothetical
- You're declining to recommend a bet ("I'd avoid this one")

The token is machine-parsed — keep the JSON valid, on its own block, with no surrounding markdown fences.
`.trim()
