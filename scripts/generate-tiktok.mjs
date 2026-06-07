/**
 * generate-tiktok.mjs — MatchMind TikTok Video Pipeline
 *
 * Pulls live prediction data → generates GPT-4o voiceover script →
 * renders a fully-designed 1080×1920 video via Creatomate's source API →
 * downloads MP4 to ~/Desktop/MatchMind TikTok Queue/POST_[date]_[type].mp4
 *
 * NO Creatomate dashboard templates needed — all 5 designs are in this file.
 *
 * Usage:
 *   node scripts/generate-tiktok.mjs edge-scanner
 *   node scripts/generate-tiktok.mjs odds-autopsy
 *   node scripts/generate-tiktok.mjs sharp-vs-square
 *   node scripts/generate-tiktok.mjs the-grind
 *   node scripts/generate-tiktok.mjs league-radar
 *   node scripts/generate-tiktok.mjs edge-scanner --dry-run   (no render, no cost)
 *
 * One-time setup:
 *   Add CREATOMATE_API_KEY to .env.local  (creatomate.com → Settings → API Key)
 *   Add ELEVENLABS_API_KEY to .env.local  (optional voice — elevenlabs.io)
 *
 * Posting schedule (UK audience, best engagement):
 *   edge-scanner    → daily 17:00 (before evening fixtures)
 *   odds-autopsy    → Tue/Thu/Sat 12:00
 *   sharp-vs-square → daily 09:00 (morning line check)
 *   the-grind       → Monday 10:00 (weekly recap)
 *   league-radar    → Sunday 18:00 (week ahead)
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { readFileSync } from 'fs'

// ── Env ──────────────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  } catch { /* .env.local is optional in CI */ }
}
loadEnv()

const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY      = process.env.OPENAI_API_KEY
const CREATOMATE_KEY  = process.env.CREATOMATE_API_KEY
const ELEVENLABS_KEY  = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_VOICE = process.env.ELEVENLABS_VOICE_ID || 'onwK4e9ZLuTAKqWW03F9' // Daniel (British)

// ── Brand tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:      '#0B0B14',
  surface: '#13131F',
  orange:  '#F97316',
  white:   '#FFFFFF',
  success: '#10B981',
  loss:    '#EF4444',
  value:   '#EACC5B',
}

const FONT = 'Montserrat'

// ── CLI ───────────────────────────────────────────────────────────────────────

const VALID_TYPES = ['edge-scanner', 'odds-autopsy', 'sharp-vs-square', 'the-grind', 'league-radar']
const type   = process.argv[2]
const dryRun = process.argv.includes('--dry-run')

if (!type || !VALID_TYPES.includes(type)) {
  console.error(`Usage: node scripts/generate-tiktok.mjs <type> [--dry-run]`)
  console.error(`Types: ${VALID_TYPES.join(' | ')}`)
  process.exit(1)
}

// ── Supabase data ─────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function bestEv(evObj) {
  if (!evObj || typeof evObj !== 'object') return 0
  return Math.max(...Object.values(evObj).filter(v => typeof v === 'number'), 0)
}

async function getAllPredictions() {
  const { data, error } = await supabase
    .from('predictions_by_league')
    .select('payload')
    .order('generated_at', { ascending: false })
  if (error) throw new Error(`Supabase: ${error.message}`)
  return (data || []).flatMap(r => Array.isArray(r.payload) ? r.payload : [])
}

async function getTopValueBets(limit = 5) {
  const all = await getAllPredictions()
  return all
    .filter(p => p.is_value_bet)
    .sort((a, b) => bestEv(b.ev) - bestEv(a.ev))
    .slice(0, limit)
    .map(p => ({
      home: p.home_team, away: p.away_team, league: p.league, date: p.date,
      bet: p.recommended_bet, oddsRange: p.recommended_odds_range,
      confidence: p.confidence, riskLevel: p.risk_level,
      homeWin: p.home_win_pct, draw: p.draw_pct, awayWin: p.away_win_pct,
      btts: p.btts_pct, over25: p.over_2_5_pct,
      bestEv: bestEv(p.ev), evDetail: p.ev,
      pinnacleEdge: p.pinnacle_edge, bookmaker: p.bookmaker,
    }))
}

async function getWeeklyStats() {
  const all = await getAllPredictions()
  const byLeague = {}
  for (const p of all.filter(p => p.is_value_bet)) {
    byLeague[p.league] = (byLeague[p.league] || 0) + 1
  }
  return Object.entries(byLeague)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([league, count]) => ({ league, count }))
}

async function getTrackRecord() {
  const { data } = await supabase
    .from('bet_slips')
    .select('result,profit_loss,stake,odds,home_team,away_team,market')
    .in('result', ['win', 'loss'])
    .order('created_at', { ascending: false })
    .limit(50)
  return data || []
}

// ── GPT script generation ─────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: OPENAI_KEY })

async function generateScript(videoType, ctx) {
  const prompts = {
    'edge-scanner': {
      system: `You write TikTok scripts for MatchMind — an AI that finds value bets by detecting when bookmakers misprice odds. Tone: direct, data-led, zero hype. Never say "guaranteed". Max 55 spoken words. End with "Full analysis at matchmind.com". Brand: dark, sharp, like proprietary trading software.`,
      user: `Top value bets today:\n${JSON.stringify(ctx.bets?.slice(0,3), null, 2)}\n\nWrite the "Edge Scanner" script. Lead with the #1 value bet. Show AI probability vs bookmaker implied %, name the EV edge. Make it sound like a radar locked onto something the market got wrong.`
    },
    'odds-autopsy': {
      system: `You write TikTok scripts that forensically dissect one football betting market. Tone: clinical, investigative — like a crime scene analyst uncovering how a bookmaker mispriced odds. Educational + punchy. Max 55 spoken words.`,
      user: `Top value bet:\n${JSON.stringify(ctx.bets?.[0], null, 2)}\n\nWrite an "Odds Autopsy" script. Dissect this specific market: bookmaker's implied probability, MatchMind's true probability, the margin they built in, and the edge found. Make the viewer feel like they're seeing behind the curtain.`
    },
    'sharp-vs-square': {
      system: `You write TikTok scripts contrasting what casual bettors back vs what MatchMind AI flags as value. Format: left panel (The Public), right panel (The Model). No hype. Max 50 spoken words. End teasing the result tomorrow.`,
      user: `Today's predictions:\n${JSON.stringify(ctx.bets?.slice(0,2), null, 2)}\n\nWrite a "Sharp vs Square" script. Pick the most interesting divergence — obvious public favourite vs what the AI actually likes. Name the stakes, don't resolve it. "Find out tomorrow."`
    },
    'the-grind': {
      system: `You write weekly TikTok scripts for a virtual £1000 bankroll tracked using MatchMind's actual track record. Tone: calm, honest, long-game. Show wins AND losses. Never hype. Max 60 spoken words.`,
      user: `Track record (50 recent bets):\n${JSON.stringify(ctx.track?.slice(0,10), null, 2)}\n\nWrite "The Grind" weekly update. Calculate this week's P&L. Give the running compounding picture. Be honest — show the process, not just the wins.`
    },
    'league-radar': {
      system: `You write weekly TikTok scripts revealing which football leagues had the most AI-detected value edges. Tone: data journalist. Rank them. Max 55 spoken words.`,
      user: `Value bets by league this week:\n${JSON.stringify(ctx.leagues, null, 2)}\n\nWrite a "League Radar" script. Name the top leagues with most edges, build curiosity about which markets are inefficient, tell them where to look.`
    },
  }

  const { system, user } = prompts[videoType]
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.7,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `${user}\n\nReturn JSON:\n{\n  "voiceover": "...",\n  "vars": { ...key display values for the video... }\n}` },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 400,
  })
  return JSON.parse(completion.choices[0].message.content)
}

// ── ElevenLabs voiceover ──────────────────────────────────────────────────────

async function generateVoiceover(text) {
  if (!ELEVENLABS_KEY) return null
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3 },
    }),
  })
  if (!res.ok) { console.warn(`  ElevenLabs ${res.status} — skipping custom voice`); return null }
  const buf = Buffer.from(await res.arrayBuffer())
  const p = path.join(os.tmpdir(), `mm_tiktok_${Date.now()}.mp3`)
  fs.writeFileSync(p, buf)
  return p
}

// ── Creatomate composition builders ──────────────────────────────────────────
//
// Rules for Creatomate REST API (inline source rendering):
//   - font_size: plain number (pixels) — NO unit strings like "3.5 vmin"
//   - font_weight: number — NOT a string
//   - fill_color: 6-char hex — use separate opacity: 0-1 for transparency
//   - width/height: percent string "50%" or pixel number — NOT "auto"
//   - No nested elements inside shape elements
//   - track: 1-1000 (never 0)
//   - Valid animation types: fade, scale, slide, wipe, text-slide, spin, bounce

function tx(props) {
  return { type: 'text', font_family: FONT, text_align: 'center', x_anchor: '50%', y_anchor: '50%', ...props }
}
function sh(props) {
  return { type: 'shape', x_anchor: '50%', y_anchor: '50%', ...props }
}
function fi(delay = 0) {
  return [{ time: delay, duration: 0.5, transition: true, type: 'fade' }]
}
function sc(delay = 0) {
  return [{ time: delay, duration: 0.5, transition: true, type: 'scale', easing: 'ease-out' }]
}

function baseComp() {
  return { output_format: 'mp4', width: 1080, height: 1920, frame_rate: 30, snapshot_time: 5, fill_color: C.bg }
}

function bgEl() {
  return sh({ track: 1, time: 0, x: '50%', y: '50%', width: '100%', height: '100%', fill_color: C.bg })
}

function ctaEls(time = 0) {
  return [
    sh({ track: 9, time, x: '50%', y: '91%', width: '100%', height: '8%', fill_color: C.surface }),
    tx({ track: 10, time, x: '50%', y: '91%', width: '88%', height: '8%', font_size: 36, font_weight: 700, fill_color: C.orange, text: 'matchmind.com' }),
    tx({ track: 10, time, x: '50%', y: '97.5%', width: '90%', height: '3%', font_size: 20, font_weight: 400, fill_color: C.white, opacity: 0.35, text: '18+ · Bet Responsibly · BeGambleAware.org' }),
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. EDGE SCANNER
// Radar locks onto a mispriced market — probability comparison + EV reveal.
// ─────────────────────────────────────────────────────────────────────────────
function buildEdgeScanner(vars) {
  const { match = 'Home vs Away', league = 'PREMIER LEAGUE', bet_type = 'Home Win',
          ai_prob = '58%', bk_prob = '52%', ev = '+12%' } = vars
  const evPos = ev.startsWith('+') || parseFloat(ev) > 0

  return {
    ...baseComp(),
    elements: [
      bgEl(),

      // ── Orange accent lines flanking header
      sh({ track: 2, time: 0, x: '50%', y: '7.5%', width: '28%', height: 3, fill_color: C.orange }),

      // ── EDGE SCANNER header
      tx({ track: 3, time: 0, x: '50%', y: '10%', width: '90%', height: '7%',
           font_size: 42, font_weight: 700, fill_color: C.orange,
           text: 'EDGE SCANNER', animations: fi(0) }),

      sh({ track: 2, time: 0, x: '50%', y: '13%', width: '28%', height: 3, fill_color: C.orange }),

      // ── League label
      tx({ track: 3, time: 0.4, x: '50%', y: '19%', width: '88%', height: '5%',
           font_size: 26, font_weight: 600, fill_color: C.white, opacity: 0.45,
           text: league.toUpperCase(), animations: fi(0) }),

      // ── Match name
      tx({ track: 4, time: 0.7, x: '50%', y: '27%', width: '88%', height: '9%',
           font_size: 58, font_weight: 800, fill_color: C.white,
           text: match, animations: fi(0) }),

      // ── Bet type background pill
      sh({ track: 3, time: 1.1, x: '50%', y: '35%', width: '55%', height: '5%',
           fill_color: C.surface, animations: fi(0) }),

      // ── Bet type text
      tx({ track: 4, time: 1.2, x: '50%', y: '35%', width: '53%', height: '5%',
           font_size: 28, font_weight: 700, fill_color: C.orange,
           text: bet_type, animations: fi(0) }),

      // ── Divider
      sh({ track: 2, time: 1.8, x: '50%', y: '42%', width: '88%', height: 2, fill_color: C.white, opacity: 0.1 }),

      // ── PROBABILITY COMPARISON label
      tx({ track: 3, time: 2, x: '50%', y: '45.5%', width: '88%', height: '4%',
           font_size: 22, font_weight: 600, fill_color: C.white, opacity: 0.5,
           text: 'PROBABILITY COMPARISON', animations: fi(0) }),

      // ── AI probability (left)
      tx({ track: 5, time: 2.3, x: '28%', y: '55%', width: '44%', height: '12%',
           font_size: 90, font_weight: 900, fill_color: C.orange,
           text: ai_prob, animations: fi(0) }),
      tx({ track: 4, time: 2.3, x: '28%', y: '63%', width: '44%', height: '4%',
           font_size: 22, font_weight: 700, fill_color: C.orange,
           text: 'AI MODEL', animations: fi(0) }),

      // ── Vertical separator
      sh({ track: 3, time: 2.3, x: '50%', y: '57%', width: 2, height: '10%', fill_color: C.white, opacity: 0.15 }),

      // ── Bookmaker probability (right)
      tx({ track: 5, time: 2.8, x: '72%', y: '55%', width: '44%', height: '12%',
           font_size: 90, font_weight: 900, fill_color: C.white, opacity: 0.35,
           text: bk_prob, animations: fi(0) }),
      tx({ track: 4, time: 2.8, x: '72%', y: '63%', width: '44%', height: '4%',
           font_size: 22, font_weight: 700, fill_color: C.white, opacity: 0.35,
           text: 'BOOKMAKER', animations: fi(0) }),

      // ── EV section
      sh({ track: 2, time: 3.5, x: '50%', y: '69%', width: '88%', height: 2, fill_color: C.white, opacity: 0.1 }),

      // ── EV label
      tx({ track: 4, time: 3.7, x: '50%', y: '73%', width: '88%', height: '4%',
           font_size: 22, font_weight: 600, fill_color: C.white, opacity: 0.5,
           text: 'EXPECTED VALUE', animations: fi(0) }),

      // ── EV box background
      sh({ track: 4, time: 3.9, x: '50%', y: '81%', width: '80%', height: '14%',
           fill_color: C.surface, animations: sc(0) }),

      // ── EV value (the big number)
      tx({ track: 5, time: 4, x: '50%', y: '81%', width: '78%', height: '12%',
           font_size: 110, font_weight: 900, fill_color: evPos ? C.orange : C.loss,
           text: ev, animations: sc(0) }),

      ...ctaEls(0),
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ODDS AUTOPSY
// Forensic dissection of one mispriced market — bookmaker vs model vs margin.
// ─────────────────────────────────────────────────────────────────────────────
function buildOddsAutopsy(vars) {
  const { match = 'Home vs Away', market = 'Away Win', bk_odds = '2.75',
          bk_implied = '36%', ai_prob = '42%', margin = '5.2%',
          ev = '+14%', verdict = 'LEAN' } = vars

  const verdictColor = verdict === 'BET' ? C.success : verdict === 'AVOID' ? C.loss : C.orange

  return {
    ...baseComp(),
    elements: [
      bgEl(),

      // ── ODDS AUTOPSY header (red tint — forensic)
      tx({ track: 3, time: 0, x: '50%', y: '8%', width: '90%', height: '6%',
           font_size: 42, font_weight: 700, fill_color: C.loss,
           text: 'ODDS AUTOPSY', animations: fi(0) }),
      sh({ track: 2, time: 0.2, x: '50%', y: '11%', width: '88%', height: 2, fill_color: C.loss, opacity: 0.35 }),

      // ── Match
      tx({ track: 3, time: 0.4, x: '50%', y: '16%', width: '88%', height: '5%',
           font_size: 28, font_weight: 500, fill_color: C.white, opacity: 0.5,
           text: match, animations: fi(0) }),

      // ── Market
      tx({ track: 4, time: 0.7, x: '50%', y: '22%', width: '88%', height: '8%',
           font_size: 62, font_weight: 900, fill_color: C.white,
           text: market, animations: fi(0) }),

      // ── Odds
      tx({ track: 3, time: 0.9, x: '50%', y: '28%', width: '88%', height: '5%',
           font_size: 32, font_weight: 600, fill_color: C.white, opacity: 0.5,
           text: `@ ${bk_odds}`, animations: fi(0) }),

      // ── Divider
      sh({ track: 2, time: 1.3, x: '50%', y: '32%', width: '88%', height: 2, fill_color: C.white, opacity: 0.08 }),

      // ── BOOKMAKER SAYS
      tx({ track: 3, time: 1.5, x: '50%', y: '36%', width: '88%', height: '4%',
           font_size: 24, font_weight: 600, fill_color: C.white, opacity: 0.5,
           text: 'BOOKMAKER SAYS', animations: fi(0) }),
      tx({ track: 4, time: 1.7, x: '50%', y: '43%', width: '88%', height: '11%',
           font_size: 106, font_weight: 900, fill_color: C.white,
           text: bk_implied, animations: fi(0) }),

      // ── MODEL SAYS
      tx({ track: 3, time: 3, x: '50%', y: '52%', width: '88%', height: '4%',
           font_size: 24, font_weight: 600, fill_color: C.orange,
           text: 'MODEL SAYS', animations: fi(0) }),
      tx({ track: 4, time: 3.2, x: '50%', y: '59%', width: '88%', height: '11%',
           font_size: 106, font_weight: 900, fill_color: C.orange,
           text: ai_prob, animations: sc(0) }),

      // ── Margin extracted box
      sh({ track: 3, time: 4.5, x: '50%', y: '70%', width: '80%', height: '8%',
           fill_color: C.surface, animations: fi(0) }),
      tx({ track: 4, time: 4.6, x: '50%', y: '68.5%', width: '88%', height: '3%',
           font_size: 20, font_weight: 700, fill_color: C.loss, opacity: 0.8,
           text: 'MARGIN EXTRACTED', animations: fi(0) }),
      tx({ track: 4, time: 4.7, x: '50%', y: '71%', width: '88%', height: '6%',
           font_size: 60, font_weight: 800, fill_color: C.loss,
           text: margin, animations: fi(0) }),

      // ── Edge found box
      sh({ track: 3, time: 5.5, x: '50%', y: '81%', width: '80%', height: '8%',
           fill_color: C.surface, animations: fi(0) }),
      tx({ track: 4, time: 5.6, x: '50%', y: '79.5%', width: '88%', height: '3%',
           font_size: 20, font_weight: 700, fill_color: C.orange, opacity: 0.8,
           text: 'EDGE FOUND', animations: fi(0) }),
      tx({ track: 4, time: 5.7, x: '50%', y: '82%', width: '88%', height: '6%',
           font_size: 60, font_weight: 800, fill_color: C.orange,
           text: ev, animations: fi(0) }),

      // ── Verdict badge
      sh({ track: 5, time: 7, x: '50%', y: '88.5%', width: '50%', height: '5%',
           fill_color: C.surface, animations: sc(0) }),
      tx({ track: 6, time: 7.1, x: '50%', y: '88.5%', width: '48%', height: '5%',
           font_size: 38, font_weight: 900, fill_color: verdictColor,
           text: verdict, animations: fi(0) }),

      ...ctaEls(0),
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SHARP VS SQUARE
// Split screen: public favourite (muted left) vs AI model pick (orange right).
// ─────────────────────────────────────────────────────────────────────────────
function buildSharpVsSquare(vars) {
  const { match = 'Home vs Away', public_pick = 'Home Win',
          public_odds = '1.65', public_implied = '61%',
          ai_pick = 'Draw', ai_odds = '3.40', ai_prob = '38%' } = vars

  return {
    ...baseComp(),
    elements: [
      bgEl(),

      // ── SHARP VS SQUARE header
      tx({ track: 3, time: 0, x: '50%', y: '7%', width: '90%', height: '6%',
           font_size: 40, font_weight: 700, fill_color: C.white,
           text: 'SHARP VS SQUARE', animations: fi(0) }),
      tx({ track: 3, time: 0.2, x: '50%', y: '11.5%', width: '88%', height: '5%',
           font_size: 28, font_weight: 500, fill_color: C.white, opacity: 0.45,
           text: match, animations: fi(0) }),
      sh({ track: 2, time: 0.4, x: '50%', y: '15%', width: '88%', height: 2, fill_color: C.white, opacity: 0.08 }),

      // ── Left panel background (the public)
      sh({ track: 2, time: 0.8, x: '27%', y: '47%', width: '50%', height: '60%',
           fill_color: C.surface, animations: fi(0) }),

      // ── THE PUBLIC label
      tx({ track: 4, time: 1, x: '27%', y: '21%', width: '48%', height: '4%',
           font_size: 22, font_weight: 700, fill_color: C.white, opacity: 0.5,
           text: 'THE PUBLIC', animations: fi(0) }),
      sh({ track: 3, time: 1, x: '27%', y: '23.5%', width: '36%', height: 2, fill_color: C.white, opacity: 0.2 }),

      // ── Public pick
      tx({ track: 4, time: 1.3, x: '27%', y: '32%', width: '48%', height: '8%',
           font_size: 52, font_weight: 900, fill_color: C.white, opacity: 0.5,
           text: public_pick, animations: fi(0) }),
      tx({ track: 4, time: 1.5, x: '27%', y: '39%', width: '48%', height: '5%',
           font_size: 36, font_weight: 700, fill_color: C.white, opacity: 0.4,
           text: `@ ${public_odds}`, animations: fi(0) }),
      tx({ track: 4, time: 1.7, x: '27%', y: '44%', width: '48%', height: '4%',
           font_size: 28, font_weight: 500, fill_color: C.white, opacity: 0.3,
           text: public_implied, animations: fi(0) }),

      // ── VS
      tx({ track: 5, time: 2.2, x: '50%', y: '34%', width: '12%', height: '5%',
           font_size: 32, font_weight: 900, fill_color: C.white, opacity: 0.4,
           text: 'VS', animations: sc(0) }),

      // ── Right panel background (the model)
      sh({ track: 2, time: 1.8, x: '73%', y: '47%', width: '50%', height: '60%',
           fill_color: C.surface, animations: fi(0) }),

      // ── Orange left border accent for right panel
      sh({ track: 3, time: 1.8, x: '49%', y: '47%', width: 3, height: '60%',
           fill_color: C.orange, opacity: 0.7, x_anchor: '0%', y_anchor: '50%' }),

      // ── THE MODEL label
      tx({ track: 4, time: 2, x: '73%', y: '21%', width: '48%', height: '4%',
           font_size: 22, font_weight: 700, fill_color: C.orange,
           text: 'THE MODEL', animations: fi(0) }),
      sh({ track: 3, time: 2, x: '73%', y: '23.5%', width: '36%', height: 2, fill_color: C.orange, opacity: 0.5 }),

      // ── AI pick
      tx({ track: 4, time: 2.3, x: '73%', y: '32%', width: '48%', height: '8%',
           font_size: 52, font_weight: 900, fill_color: C.orange,
           text: ai_pick, animations: fi(0) }),
      tx({ track: 4, time: 2.5, x: '73%', y: '39%', width: '48%', height: '5%',
           font_size: 36, font_weight: 700, fill_color: C.white,
           text: `@ ${ai_odds}`, animations: fi(0) }),
      tx({ track: 4, time: 2.7, x: '73%', y: '44%', width: '48%', height: '4%',
           font_size: 28, font_weight: 500, fill_color: C.orange,
           text: `${ai_prob} true`, animations: fi(0) }),

      // ── Find out tomorrow
      sh({ track: 4, time: 9, x: '50%', y: '79%', width: '92%', height: '7%',
           fill_color: C.surface, animations: fi(0) }),
      tx({ track: 5, time: 9.2, x: '50%', y: '79%', width: '88%', height: '6%',
           font_size: 36, font_weight: 700, fill_color: C.white,
           text: 'Find out tomorrow →', animations: fi(0) }),

      ...ctaEls(0),
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE GRIND — Serial bankroll tracker
// Honest weekly P&L. Transparency = trust. Long-game mindset.
// ─────────────────────────────────────────────────────────────────────────────
function buildTheGrind(vars) {
  const { week_num = '1', week_pnl = '+4.2u', running_total = '£1,042',
          wins = 3, losses = 2, bets_text = '5 bets settled this week' } = vars

  const pnlPos = String(week_pnl).startsWith('+') || parseFloat(week_pnl) > 0
  const pnlColor = pnlPos ? C.success : C.loss
  const winsNum = Number(wins)
  const lossesNum = Number(losses)
  const total = Math.max(winsNum + lossesNum, 1)
  const winBarPct = Math.round((winsNum / total) * 88)

  return {
    ...baseComp(),
    elements: [
      bgEl(),

      // ── THE GRIND header
      tx({ track: 3, time: 0, x: '50%', y: '7%', width: '90%', height: '5%',
           font_size: 28, font_weight: 700, fill_color: C.white, opacity: 0.5,
           text: 'THE GRIND', animations: fi(0) }),
      tx({ track: 3, time: 0.2, x: '50%', y: '12%', width: '90%', height: '8%',
           font_size: 64, font_weight: 900, fill_color: C.white,
           text: `WEEK ${week_num}`, animations: fi(0) }),
      sh({ track: 2, time: 0.4, x: '50%', y: '16%', width: '88%', height: 2, fill_color: C.white, opacity: 0.08 }),

      // ── Bets summary text
      tx({ track: 3, time: 0.8, x: '50%', y: '19.5%', width: '88%', height: '4%',
           font_size: 26, font_weight: 500, fill_color: C.white, opacity: 0.5,
           text: bets_text, animations: fi(0) }),

      // ── W badge background
      sh({ track: 2, time: 1, x: '34%', y: '26%', width: '30%', height: '8%',
           fill_color: C.surface, animations: fi(0) }),
      // ── W badge text
      tx({ track: 4, time: 1.1, x: '34%', y: '26%', width: '30%', height: '8%',
           font_size: 48, font_weight: 900, fill_color: C.success,
           text: `${wins}W`, animations: fi(0) }),

      // ── L badge background
      sh({ track: 2, time: 1, x: '66%', y: '26%', width: '30%', height: '8%',
           fill_color: C.surface, animations: fi(0) }),
      // ── L badge text
      tx({ track: 4, time: 1.1, x: '66%', y: '26%', width: '30%', height: '8%',
           font_size: 48, font_weight: 900, fill_color: C.loss,
           text: `${losses}L`, animations: fi(0) }),

      // ── Win/loss bar background
      sh({ track: 2, time: 1.8, x: '50%', y: '33.5%', width: '88%', height: '1.5%',
           fill_color: C.loss, opacity: 0.2, animations: fi(0) }),
      // ── Win portion of bar
      sh({ track: 3, time: 2, x_anchor: '0%', y_anchor: '50%',
           x: '6%', y: '33.5%', width: `${winBarPct}%`, height: '1.5%',
           fill_color: C.success,
           animations: [{ time: 0, duration: 0.8, type: 'wipe', direction: 'right', easing: 'ease-out' }] }),

      // ── Divider
      sh({ track: 2, time: 2.5, x: '50%', y: '38%', width: '88%', height: 2, fill_color: C.white, opacity: 0.08 }),

      // ── WEEK P&L label
      tx({ track: 3, time: 2.8, x: '50%', y: '42%', width: '88%', height: '4%',
           font_size: 24, font_weight: 700, fill_color: C.white, opacity: 0.5,
           text: 'WEEK P&L', animations: fi(0) }),

      // ── Big P&L number
      tx({ track: 4, time: 3, x: '50%', y: '50%', width: '90%', height: '13%',
           font_size: 130, font_weight: 900, fill_color: pnlColor,
           text: week_pnl, animations: sc(0) }),

      // ── Divider
      sh({ track: 2, time: 4.5, x: '50%', y: '58%', width: '88%', height: 2, fill_color: C.white, opacity: 0.08 }),

      // ── RUNNING TOTAL label
      tx({ track: 3, time: 5, x: '50%', y: '62%', width: '88%', height: '4%',
           font_size: 24, font_weight: 700, fill_color: C.white, opacity: 0.5,
           text: 'RUNNING TOTAL', animations: fi(0) }),

      // ── Running total value
      tx({ track: 4, time: 5.2, x: '50%', y: '71%', width: '90%', height: '12%',
           font_size: 108, font_weight: 900, fill_color: C.white,
           text: running_total, animations: fi(0) }),

      // ── Starting point note
      tx({ track: 3, time: 5.5, x: '50%', y: '79%', width: '88%', height: '4%',
           font_size: 24, font_weight: 500, fill_color: C.white, opacity: 0.4,
           text: 'starting from £1,000 · Kelly sizing', animations: fi(0) }),

      ...ctaEls(0),
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. LEAGUE RADAR
// Weekly data journalism: which leagues had the most detected edges.
// ─────────────────────────────────────────────────────────────────────────────
function buildLeagueRadar(vars) {
  const { week_num = '1', leagues = [], top_league = '' } = vars

  const items = Array.isArray(leagues) ? leagues.slice(0, 6) : []
  const maxCount = Math.max(...items.map(l => l.count || 0), 1)

  const leagueRows = items.flatMap((item, i) => {
    const t = 1.5 + i * 0.35
    const yPct = 27 + i * 9
    const barW = `${Math.max(Math.round((item.count / maxCount) * 68), 8)}%`
    const isTop = i === 0
    return [
      tx({ track: 4, time: t, x: '8%', y: `${yPct}%`, x_anchor: '0%', width: '8%', height: '4%',
           font_size: 30, font_weight: 900, fill_color: isTop ? C.orange : C.white, opacity: isTop ? 1 : 0.4,
           text_align: 'left', text: `${i + 1}`, animations: fi(0) }),
      tx({ track: 4, time: t, x: '17%', y: `${yPct - 0.5}%`, x_anchor: '0%', width: '55%', height: '4%',
           font_size: isTop ? 28 : 26, font_weight: isTop ? 700 : 500,
           fill_color: isTop ? C.white : C.white, opacity: isTop ? 1 : 0.5,
           text_align: 'left', text: item.league, animations: fi(0) }),
      tx({ track: 4, time: t, x: '93%', y: `${yPct - 0.5}%`, x_anchor: '100%', width: '22%', height: '4%',
           font_size: 26, font_weight: 700,
           fill_color: isTop ? C.orange : C.white, opacity: isTop ? 1 : 0.4,
           text_align: 'right', text: `${item.count}`, animations: fi(0) }),
      sh({ track: 2, time: t + 0.1, x_anchor: '0%', y_anchor: '50%',
           x: '17%', y: `${yPct + 3}%`, width: barW, height: '0.8%',
           fill_color: isTop ? C.orange : C.white, opacity: isTop ? 0.8 : 0.15,
           animations: [{ time: 0, duration: 0.5, type: 'wipe', direction: 'right', easing: 'ease-out' }] }),
    ]
  })

  return {
    ...baseComp(),
    elements: [
      bgEl(),

      // ── LEAGUE RADAR header
      tx({ track: 3, time: 0, x: '50%', y: '8%', width: '90%', height: '6%',
           font_size: 42, font_weight: 700, fill_color: C.orange,
           text: 'LEAGUE RADAR', animations: fi(0) }),
      tx({ track: 3, time: 0.2, x: '50%', y: '12.5%', width: '88%', height: '4%',
           font_size: 24, font_weight: 500, fill_color: C.white, opacity: 0.45,
           text: `WEEK ${week_num} · VALUE EDGES DETECTED`, animations: fi(0) }),
      sh({ track: 2, time: 0.4, x: '50%', y: '16%', width: '88%', height: 2, fill_color: C.white, opacity: 0.08 }),

      // ── Column headers
      tx({ track: 3, time: 1, x: '17%', y: '20.5%', x_anchor: '0%', width: '40%', height: '3%',
           font_size: 20, font_weight: 600, fill_color: C.white, opacity: 0.3,
           text_align: 'left', text: 'LEAGUE', animations: fi(0) }),
      tx({ track: 3, time: 1, x: '93%', y: '20.5%', x_anchor: '100%', width: '20%', height: '3%',
           font_size: 20, font_weight: 600, fill_color: C.white, opacity: 0.3,
           text_align: 'right', text: 'EDGES', animations: fi(0) }),
      sh({ track: 2, time: 1, x: '50%', y: '23%', width: '88%', height: 2, fill_color: C.white, opacity: 0.06 }),

      // ── League rows (dynamic)
      ...leagueRows,

      // ── Top league highlight bar
      ...(top_league ? [
        sh({ track: 4, time: 5, x: '50%', y: '89%', width: '88%', height: '6%',
             fill_color: C.surface, animations: fi(0) }),
        tx({ track: 5, time: 5.1, x: '50%', y: '89%', width: '86%', height: '6%',
             font_size: 30, font_weight: 700, fill_color: C.orange,
             text: `#1 THIS WEEK · ${top_league}`, animations: fi(0) }),
      ] : []),

      ...ctaEls(0),
    ],
  }
}

// ── Composition router ────────────────────────────────────────────────────────

function buildSource(videoType, scriptVars, ctxData) {
  const v = { ...scriptVars }

  // Merge context data into vars for data-driven fields
  if (videoType === 'edge-scanner' && ctxData.bets?.[0]) {
    const b = ctxData.bets[0]
    v.match     = v.match     || `${b.home} vs ${b.away}`
    v.league    = v.league    || b.league?.toUpperCase()
    v.bet_type  = v.bet_type  || b.bet
    v.ai_prob   = v.ai_prob   || `${b.homeWin || b.awayWin || 50}%`
    v.bk_prob   = v.bk_prob   || `${b.bookmaker?.home ? Math.round((1/b.bookmaker.home)*100) : 50}%`
    v.ev        = v.ev        || `+${b.bestEv}%`
  }
  if (videoType === 'the-grind' && ctxData.track?.length) {
    const recent = ctxData.track.slice(0, 20)
    const wins = recent.filter(b => b.result === 'win').length
    const losses = recent.filter(b => b.result === 'loss').length
    const weekPnl = recent.reduce((s, b) => s + (b.profit_loss || 0), 0)
    v.wins         = v.wins         || wins
    v.losses       = v.losses       || losses
    v.week_pnl     = v.week_pnl     || `${weekPnl >= 0 ? '+' : ''}${weekPnl.toFixed(1)}u`
    v.bets_text    = v.bets_text    || `${recent.length} recent bets tracked`
  }
  if (videoType === 'league-radar' && ctxData.leagues?.length) {
    v.leagues    = v.leagues    || ctxData.leagues
    v.top_league = v.top_league || ctxData.leagues[0]?.league
  }
  if (videoType === 'sharp-vs-square' && ctxData.bets?.length >= 2) {
    const [top, second] = ctxData.bets
    v.match          = v.match          || `${top.home} vs ${top.away}`
    v.public_pick    = v.public_pick    || `${top.home} Win`
    v.public_odds    = v.public_odds    || top.bookmaker?.home?.toFixed(2) || '1.65'
    v.public_implied = v.public_implied || `${Math.round((1/(top.bookmaker?.home||1.65))*100)}%`
    v.ai_pick        = v.ai_pick        || second.bet
    v.ai_odds        = v.ai_odds        || second.bookmaker?.home?.toFixed(2) || '3.40'
    v.ai_prob        = v.ai_prob        || `${second.awayWin || second.homeWin || 35}%`
  }
  if (videoType === 'odds-autopsy' && ctxData.bets?.[0]) {
    const b = ctxData.bets[0]
    const bkOdds = b.bookmaker?.home || b.bookmaker?.away || 2.5
    const bkImpl = Math.round((1/bkOdds)*100)
    v.match      = v.match      || `${b.home} vs ${b.away}`
    v.market     = v.market     || b.bet
    v.bk_odds    = v.bk_odds    || bkOdds.toFixed(2)
    v.bk_implied = v.bk_implied || `${bkImpl}%`
    v.ai_prob    = v.ai_prob    || `${b.homeWin || b.awayWin || 50}%`
    v.ev         = v.ev         || `+${b.bestEv}%`
    v.verdict    = v.verdict    || 'LEAN'
  }

  switch (videoType) {
    case 'edge-scanner':    return buildEdgeScanner(v)
    case 'odds-autopsy':    return buildOddsAutopsy(v)
    case 'sharp-vs-square': return buildSharpVsSquare(v)
    case 'the-grind':       return buildTheGrind(v)
    case 'league-radar':    return buildLeagueRadar(v)
  }
}

// ── Creatomate render ─────────────────────────────────────────────────────────

async function renderVideo(source) {
  const res = await fetch('https://api.creatomate.com/v1/renders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CREATOMATE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Creatomate ${res.status}: ${err}`)
  }
  const renders = await res.json()
  return renders[0]
}

async function pollRender(renderId, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000))
    const res = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
      headers: { Authorization: `Bearer ${CREATOMATE_KEY}` },
    })
    const render = await res.json()
    if (render.status === 'succeeded') return render
    if (render.status === 'failed') throw new Error(`Render failed: ${render.error_message}`)
    process.stdout.write('.')
  }
  throw new Error('Render timed out')
}

async function downloadFile(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download ${res.status}`)
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

// ── Output path ───────────────────────────────────────────────────────────────

function suggestedPostISO(videoType) {
  const schedule = {
    'edge-scanner': 17, 'odds-autopsy': 12, 'sharp-vs-square': 9,
    'the-grind': 10, 'league-radar': 18,
  }
  const d = new Date()
  d.setHours(schedule[videoType], 0, 0, 0)
  if (d <= new Date()) d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function buildOutputPath(videoType) {
  const dir = path.join(os.homedir(), 'Desktop', 'MatchMind TikTok Queue')
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `POST_${suggestedPostISO(videoType)}_${videoType}.mp4`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nMatchMind TikTok Pipeline — ${type}${dryRun ? ' (DRY RUN)' : ''}\n`)

  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase env vars'); process.exit(1) }
  if (!OPENAI_KEY)   { console.error('Missing OPENAI_API_KEY'); process.exit(1) }
  if (!dryRun && !CREATOMATE_KEY) {
    console.error('Missing CREATOMATE_API_KEY in .env.local')
    console.error('  → Sign up at creatomate.com → Settings → API Key')
    console.error('  → Add: CREATOMATE_API_KEY=your_key_here')
    process.exit(1)
  }

  // Fetch data
  console.log('Fetching data...')
  const ctx = {}
  if (['edge-scanner', 'odds-autopsy', 'sharp-vs-square'].includes(type)) {
    ctx.bets = await getTopValueBets(5)
    if (!ctx.bets.length) { console.error('No value bets found today — check predictions cron ran'); process.exit(1) }
    console.log(`  ${ctx.bets.length} value bets loaded`)
  }
  if (type === 'the-grind') {
    ctx.track = await getTrackRecord()
    console.log(`  ${ctx.track.length} track record bets loaded`)
  }
  if (type === 'league-radar') {
    ctx.leagues = await getWeeklyStats()
    console.log(`  ${ctx.leagues.length} leagues with value bets this week`)
  }

  // Generate script
  console.log('Generating script...')
  const script = await generateScript(type, ctx)
  console.log('\n  VOICEOVER:', script.voiceover)
  console.log('  VARS:', JSON.stringify(script.vars, null, 4))

  if (dryRun) {
    const source = buildSource(type, script.vars || {}, ctx)
    console.log('\n  COMPOSITION PREVIEW (first 3 elements):')
    console.log(JSON.stringify(source.elements.slice(0, 3), null, 2))
    console.log(`\n  Total elements: ${source.elements.length}`)
    console.log('\nDry run complete — no render, no cost.')
    return
  }

  // Optional ElevenLabs voice
  console.log('\nGenerating voiceover...')
  const audioPath = await generateVoiceover(script.voiceover)
  if (!audioPath) console.log('  Using silent render (add ELEVENLABS_API_KEY for voiceover)')

  // Build composition with real data
  const source = buildSource(type, script.vars || {}, ctx)

  // Render
  console.log('\nRendering with Creatomate...')
  const render = await renderVideo(source)
  console.log(`  Render ID: ${render.id}`)
  process.stdout.write('  Waiting')
  const completed = await pollRender(render.id)
  console.log('\n  Done')

  // Download
  const dest = buildOutputPath(type)
  console.log(`\nDownloading → ${path.basename(dest)}`)
  await downloadFile(completed.url, dest)

  // Cleanup
  if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath)

  const postDate = suggestedPostISO(type)
  console.log(`\nFile saved: ${dest}`)
  console.log(`Post on:    ${postDate}`)
  console.log(`\nReview before posting. 18+ Bet Responsibly.`)
}

main().catch(e => { console.error('\nError:', e.message); process.exit(1) })
