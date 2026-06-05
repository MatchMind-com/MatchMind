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
  bg:       '#0B0B14',
  surface:  '#13131F',
  orange:   '#F97316',
  white:    '#FFFFFF',
  muted:    '#FFFFFF55',
  veryMuted:'#FFFFFF25',
  success:  '#10B981',
  loss:     '#EF4444',
  value:    '#EACC5B',
  border:   '#FFFFFF14',
  orangeBg: '#F9731618',
  successBg:'#10B98118',
  lossBg:   '#EF444418',
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
// Each builder returns a full Creatomate source JSON (1080×1920, 9:16).
// No template IDs required — these are rendered inline.
//
// Design system:
//   bg: #0B0B14  surface: #13131F  orange: #F97316
//   Font: Montserrat (auto-loaded by Creatomate via Google Fonts)

// Shared element builders
function bg() {
  return { type: 'shape', track: 1, time: 0, x: '50%', y: '50%', width: '100%', height: '100%', fillColor: C.bg }
}

function txt(props) {
  return { type: 'text', fontFamily: FONT, textAlign: 'center', xAnchor: '50%', yAnchor: '50%', ...props }
}

function shape(props) {
  return { type: 'shape', xAnchor: '50%', yAnchor: '50%', ...props }
}

function fadeIn(delay = 0, dur = 0.5) {
  return [{ time: delay, duration: dur, transition: true, type: 'fade' }]
}

function slideUp(delay = 0, dist = '40px') {
  return [{ time: delay, duration: 0.55, transition: true, type: 'text-slide', direction: 'up', distance: dist, easing: 'ease-out' }]
}

function disclaimer() {
  return txt({
    track: 10, time: 0,
    x: '50%', y: '97.5%', width: '90%', height: 'auto',
    fontSize: '2.2 vmin', fontWeight: '400', fillColor: C.muted,
    text: '18+ · Bet Responsibly · BeGambleAware.org',
  })
}

function ctaBar(t, dur) {
  return [
    shape({ track: 9, time: t, duration: dur, x: '50%', y: '90%', width: '92%', height: '9%', fillColor: C.surface, animations: fadeIn(0, 0.4) }),
    txt({ track: 10, time: t, duration: dur, x: '50%', y: '90%', width: '88%', height: 'auto', fontSize: '4 vmin', fontWeight: '700', fillColor: C.orange, text: 'matchmind.com', animations: fadeIn(0.2, 0.5) }),
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. EDGE SCANNER
// Radar aesthetic: locks onto a mispriced market like targeting software.
// ─────────────────────────────────────────────────────────────────────────────
function buildEdgeScanner(vars) {
  const { match = 'Home vs Away', league = 'PREMIER LEAGUE', bet_type = 'Home Win',
          ai_prob = '58%', bk_prob = '52%', ev = '+12%' } = vars

  const aiNum = parseInt(ai_prob) || 58
  const bkNum = parseInt(bk_prob) || 52
  const aiBarW = `${Math.min(aiNum * 0.88, 88)}%`
  const bkBarW = `${Math.min(bkNum * 0.88, 88)}%`
  const evPos = (ev.includes('+') || parseInt(ev) > 0) ? true : false

  return {
    outputFormat: 'mp4', width: 1080, height: 1920, frameRate: 30,
    fillColor: C.bg,
    elements: [
      bg(),

      // ── Header
      shape({ track: 2, time: 0, x: '50%', y: '8%', width: '35%', height: '0.3%', fillColor: C.orange, animations: fadeIn(0.1) }),
      txt({ track: 3, time: 0.1, x: '50%', y: '10%', width: '90%', height: 'auto', fontSize: '3.5 vmin', fontWeight: '700', fillColor: C.orange, letterSpacing: 5, text: 'EDGE SCANNER', animations: fadeIn(0, 0.5) }),
      shape({ track: 2, time: 0.1, x: '50%', y: '12%', width: '35%', height: '0.3%', fillColor: C.orange, animations: fadeIn(0.1) }),

      // ── Scanning pulse line (0-2.5s)
      shape({ track: 4, time: 0, duration: 2.5, x: '50%', y: '22%', width: '92%', height: '0.2%', fillColor: C.orange, opacity: 0.6,
        animations: [{ time: 0, duration: 2.5, type: 'wipe', direction: 'right', easing: 'linear' }] }),

      // ── Match card
      shape({ track: 2, time: 1.5, x: '50%', y: '26%', width: '92%', height: '22%', fillColor: C.surface, animations: fadeIn(0, 0.5) }),
      txt({ track: 4, time: 1.7, x: '50%', y: '22.5%', width: '88%', height: 'auto', fontSize: '2.5 vmin', fontWeight: '600', fillColor: C.muted, letterSpacing: 3, text: league.toUpperCase(), animations: fadeIn(0, 0.4) }),
      txt({ track: 4, time: 1.9, x: '50%', y: '26.5%', width: '88%', height: 'auto', fontSize: '5.8 vmin', fontWeight: '800', fillColor: C.white, lineHeight: 1.1, text: match, animations: slideUp(0) }),
      shape({ track: 3, time: 2.2, x: '50%', y: '32%', width: 'auto', height: 'auto', fillColor: C.orangeBg, borderColor: C.orange, borderWidth: 1,
        elements: [txt({ text: bet_type, fontSize: '2.8 vmin', fontWeight: '700', fillColor: C.orange, xPadding: '4%', yPadding: '1.5%' })] }),

      // ── Probability comparison
      txt({ track: 4, time: 3, x: '50%', y: '43%', width: '90%', height: 'auto', fontSize: '2.2 vmin', fontWeight: '600', fillColor: C.muted, letterSpacing: 4, text: 'PROBABILITY COMPARISON', animations: fadeIn(0, 0.5) }),

      // AI row
      txt({ track: 4, time: 3.2, x: '7%', y: '47.5%', width: 'auto', height: 'auto', xAnchor: '0%', fontSize: '2.5 vmin', fontWeight: '700', fillColor: C.orange, text: 'AI MODEL', animations: fadeIn(0, 0.4) }),
      txt({ track: 4, time: 3.2, x: '93%', y: '47.5%', width: 'auto', height: 'auto', xAnchor: '100%', fontSize: '3 vmin', fontWeight: '800', fillColor: C.orange, text: ai_prob, animations: fadeIn(0, 0.4) }),
      shape({ track: 2, time: 3.3, x: '7%', y: '50%', xAnchor: '0%', width: '86%', height: '1.3%', fillColor: C.veryMuted, animations: fadeIn(0, 0.3) }),
      shape({ track: 3, time: 3.5, x: '7%', y: '50%', xAnchor: '0%', width: aiBarW, height: '1.3%', fillColor: C.orange,
        animations: [{ time: 0, duration: 0.9, type: 'wipe', direction: 'right', easing: 'ease-out' }] }),

      // Bookmaker row
      txt({ track: 4, time: 4.5, x: '7%', y: '55%', width: 'auto', height: 'auto', xAnchor: '0%', fontSize: '2.5 vmin', fontWeight: '700', fillColor: C.muted, text: 'BOOKMAKER', animations: fadeIn(0, 0.4) }),
      txt({ track: 4, time: 4.5, x: '93%', y: '55%', width: 'auto', height: 'auto', xAnchor: '100%', fontSize: '3 vmin', fontWeight: '800', fillColor: C.muted, text: bk_prob, animations: fadeIn(0, 0.4) }),
      shape({ track: 2, time: 4.6, x: '7%', y: '57.5%', xAnchor: '0%', width: '86%', height: '1.3%', fillColor: C.veryMuted, animations: fadeIn(0, 0.3) }),
      shape({ track: 3, time: 4.8, x: '7%', y: '57.5%', xAnchor: '0%', width: bkBarW, height: '1.3%', fillColor: C.muted,
        animations: [{ time: 0, duration: 0.9, type: 'wipe', direction: 'right', easing: 'ease-out' }] }),

      // ── EV callout
      shape({ track: 2, time: 7, x: '50%', y: '72%', width: '78%', height: '16%', fillColor: C.surface, borderColor: C.orange, borderWidth: 2, animations: [{ time: 0, duration: 0.5, transition: true, type: 'scale', easing: 'ease-out' }] }),
      txt({ track: 4, time: 7.2, x: '50%', y: '68.5%', width: 'auto', height: 'auto', fontSize: '2.2 vmin', fontWeight: '700', fillColor: C.muted, letterSpacing: 5, text: 'EXPECTED VALUE', animations: fadeIn(0, 0.4) }),
      txt({ track: 4, time: 7.3, x: '50%', y: '72.5%', width: '90%', height: 'auto', fontSize: '11 vmin', fontWeight: '900', fillColor: evPos ? C.orange : C.loss, text: ev,
        animations: [{ time: 0, duration: 0.6, transition: true, type: 'scale', easing: 'ease-out' }] }),

      ...ctaBar(20, 10),
      disclaimer(),
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ODDS AUTOPSY
// Forensic dissection of one mispriced market.
// ─────────────────────────────────────────────────────────────────────────────
function buildOddsAutopsy(vars) {
  const { match = 'Home vs Away', market = 'Away Win', bk_odds = '2.75',
          bk_implied = '36%', ai_prob = '42%', margin = '5.2%',
          ev = '+14%', verdict = 'LEAN' } = vars

  const verdictColor = verdict === 'BET' ? C.success : verdict === 'LEAN' ? C.orange : verdict === 'AVOID' ? C.loss : C.muted
  const verdictBg = verdict === 'BET' ? C.successBg : verdict === 'LEAN' ? C.orangeBg : verdict === 'AVOID' ? C.lossBg : C.border

  return {
    outputFormat: 'mp4', width: 1080, height: 1920, frameRate: 30,
    fillColor: C.bg,
    elements: [
      bg(),

      // ── Header
      txt({ track: 3, time: 0, x: '50%', y: '8%', width: '90%', height: 'auto', fontSize: '3.5 vmin', fontWeight: '700', fillColor: C.loss, letterSpacing: 5, text: 'ODDS AUTOPSY', animations: fadeIn(0, 0.5) }),
      shape({ track: 2, time: 0.2, x: '50%', y: '10.5%', width: '92%', height: '0.15%', fillColor: C.loss, opacity: 0.4, animations: fadeIn(0, 0.5) }),

      // ── Match + market
      txt({ track: 4, time: 0.5, x: '50%', y: '16%', width: '88%', height: 'auto', fontSize: '2.8 vmin', fontWeight: '600', fillColor: C.muted, text: match, animations: fadeIn(0, 0.5) }),
      txt({ track: 4, time: 0.8, x: '50%', y: '21%', width: '90%', height: 'auto', fontSize: '6 vmin', fontWeight: '900', fillColor: C.white, text: market, animations: slideUp(0) }),
      txt({ track: 4, time: 1, x: '50%', y: '26%', width: '88%', height: 'auto', fontSize: '3 vmin', fontWeight: '600', fillColor: C.muted, text: `@ ${bk_odds}`, animations: fadeIn(0, 0.5) }),

      // ── Divider
      shape({ track: 2, time: 1.5, x: '50%', y: '31%', width: '92%', height: '0.15%', fillColor: C.border, animations: fadeIn(0, 0.5) }),

      // ── Bookmaker implied
      txt({ track: 3, time: 2, x: '50%', y: '36%', width: '88%', height: 'auto', fontSize: '2.3 vmin', fontWeight: '600', fillColor: C.muted, letterSpacing: 3, text: 'BOOKMAKER SAYS', animations: fadeIn(0, 0.5) }),
      txt({ track: 4, time: 2.2, x: '50%', y: '42%', width: '90%', height: 'auto', fontSize: '10 vmin', fontWeight: '900', fillColor: C.white, text: bk_implied, animations: fadeIn(0, 0.6) }),

      // ── AI true probability
      txt({ track: 3, time: 3.5, x: '50%', y: '51%', width: '88%', height: 'auto', fontSize: '2.3 vmin', fontWeight: '600', fillColor: C.orange, letterSpacing: 3, text: 'MODEL SAYS', animations: fadeIn(0, 0.5) }),
      txt({ track: 4, time: 3.7, x: '50%', y: '57%', width: '90%', height: 'auto', fontSize: '10 vmin', fontWeight: '900', fillColor: C.orange, text: ai_prob, animations: [{ time: 0, duration: 0.6, transition: true, type: 'scale', easing: 'ease-out' }] }),

      // ── Margin extracted
      shape({ track: 2, time: 5, x: '50%', y: '67%', width: '78%', height: '8%', fillColor: C.lossBg, borderColor: C.loss, borderWidth: 1, animations: fadeIn(0, 0.4) }),
      txt({ track: 4, time: 5.1, x: '50%', y: '65.5%', width: 'auto', height: 'auto', fontSize: '2 vmin', fontWeight: '700', fillColor: C.loss, letterSpacing: 4, text: 'MARGIN EXTRACTED', animations: fadeIn(0, 0.4) }),
      txt({ track: 4, time: 5.2, x: '50%', y: '67.5%', width: '90%', height: 'auto', fontSize: '6 vmin', fontWeight: '800', fillColor: C.loss, text: margin, animations: fadeIn(0, 0.5) }),

      // ── Edge found
      shape({ track: 2, time: 6, x: '50%', y: '78%', width: '78%', height: '8%', fillColor: C.orangeBg, borderColor: C.orange, borderWidth: 1, animations: fadeIn(0, 0.4) }),
      txt({ track: 4, time: 6.1, x: '50%', y: '76.5%', width: 'auto', height: 'auto', fontSize: '2 vmin', fontWeight: '700', fillColor: C.orange, letterSpacing: 4, text: 'EDGE FOUND', animations: fadeIn(0, 0.4) }),
      txt({ track: 4, time: 6.2, x: '50%', y: '78.5%', width: '90%', height: 'auto', fontSize: '6 vmin', fontWeight: '800', fillColor: C.orange, text: ev, animations: fadeIn(0, 0.5) }),

      // ── Verdict badge
      shape({ track: 2, time: 8, x: '50%', y: '87%', width: '55%', height: '6%', fillColor: verdictBg, borderColor: verdictColor, borderWidth: 2, animations: [{ time: 0, duration: 0.5, transition: true, type: 'scale' }] }),
      txt({ track: 4, time: 8.1, x: '50%', y: '87%', width: 'auto', height: 'auto', fontSize: '4 vmin', fontWeight: '900', fillColor: verdictColor, letterSpacing: 6, text: verdict, animations: fadeIn(0, 0.4) }),

      ...ctaBar(20, 15),
      disclaimer(),
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SHARP VS SQUARE
// Split-screen: Public favourite (left/grey) vs AI pick (right/orange).
// ─────────────────────────────────────────────────────────────────────────────
function buildSharpVsSquare(vars) {
  const { match = 'Home vs Away', public_pick = 'Home Win',
          public_odds = '1.65', public_implied = '61%',
          ai_pick = 'Draw', ai_odds = '3.40', ai_prob = '38%' } = vars

  return {
    outputFormat: 'mp4', width: 1080, height: 1920, frameRate: 30,
    fillColor: C.bg,
    elements: [
      bg(),

      // ── Header
      txt({ track: 3, time: 0, x: '50%', y: '7%', width: '90%', height: 'auto', fontSize: '3.5 vmin', fontWeight: '700', fillColor: C.white, letterSpacing: 4, text: 'SHARP VS SQUARE', animations: fadeIn(0, 0.5) }),
      txt({ track: 3, time: 0.2, x: '50%', y: '11%', width: '88%', height: 'auto', fontSize: '2.8 vmin', fontWeight: '500', fillColor: C.muted, text: match, animations: fadeIn(0, 0.5) }),

      // ── Divider line
      shape({ track: 2, time: 0.5, x: '50%', y: '15%', width: '92%', height: '0.15%', fillColor: C.border, animations: fadeIn(0, 0.5) }),

      // ── Left panel: The Public
      shape({ track: 2, time: 1, x: '27%', y: '47%', width: '50%', height: '60%', fillColor: C.surface, animations: fadeIn(0, 0.5) }),
      txt({ track: 4, time: 1.2, x: '27%', y: '22%', width: '48%', height: 'auto', fontSize: '2.2 vmin', fontWeight: '700', fillColor: C.muted, letterSpacing: 5, text: 'THE PUBLIC', animations: fadeIn(0, 0.5) }),
      shape({ track: 3, time: 1.2, x: '27%', y: '24.5%', width: '40%', height: '0.25%', fillColor: C.muted, opacity: 0.3, animations: fadeIn(0) }),
      txt({ track: 4, time: 1.5, x: '27%', y: '33%', width: '48%', height: 'auto', fontSize: '5 vmin', fontWeight: '900', fillColor: C.white, text: public_pick, animations: slideUp(0) }),
      txt({ track: 4, time: 1.7, x: '27%', y: '40%', width: '48%', height: 'auto', fontSize: '4 vmin', fontWeight: '700', fillColor: C.muted, text: `@ ${public_odds}`, animations: fadeIn(0, 0.4) }),
      txt({ track: 4, time: 1.9, x: '27%', y: '45%', width: '48%', height: 'auto', fontSize: '3 vmin', fontWeight: '600', fillColor: C.veryMuted, text: public_implied, animations: fadeIn(0, 0.4) }),

      // ── VS divider
      txt({ track: 5, time: 2.5, x: '50%', y: '35%', width: 'auto', height: 'auto', fontSize: '3.5 vmin', fontWeight: '900', fillColor: C.muted, text: 'VS',
        animations: [{ time: 0, duration: 0.4, transition: true, type: 'scale' }] }),

      // ── Right panel: The Model
      shape({ track: 2, time: 2, x: '73%', y: '47%', width: '50%', height: '60%', fillColor: C.orangeBg, borderColor: C.orange, borderWidth: 1, animations: fadeIn(0, 0.5) }),
      txt({ track: 4, time: 2.2, x: '73%', y: '22%', width: '48%', height: 'auto', fontSize: '2.2 vmin', fontWeight: '700', fillColor: C.orange, letterSpacing: 5, text: 'THE MODEL', animations: fadeIn(0, 0.5) }),
      shape({ track: 3, time: 2.2, x: '73%', y: '24.5%', width: '40%', height: '0.25%', fillColor: C.orange, opacity: 0.5, animations: fadeIn(0) }),
      txt({ track: 4, time: 2.5, x: '73%', y: '33%', width: '48%', height: 'auto', fontSize: '5 vmin', fontWeight: '900', fillColor: C.orange, text: ai_pick, animations: slideUp(0) }),
      txt({ track: 4, time: 2.7, x: '73%', y: '40%', width: '48%', height: 'auto', fontSize: '4 vmin', fontWeight: '700', fillColor: C.white, text: `@ ${ai_odds}`, animations: fadeIn(0, 0.4) }),
      txt({ track: 4, time: 2.9, x: '73%', y: '45%', width: '48%', height: 'auto', fontSize: '3 vmin', fontWeight: '600', fillColor: C.orange, text: `${ai_prob} true`, animations: fadeIn(0, 0.4) }),

      // ── "Find out tomorrow"
      shape({ track: 2, time: 10, x: '50%', y: '78%', width: '92%', height: '6%', fillColor: C.surface, animations: fadeIn(0, 0.5) }),
      txt({ track: 4, time: 10.2, x: '50%', y: '78%', width: '88%', height: 'auto', fontSize: '3.5 vmin', fontWeight: '700', fillColor: C.white, text: 'Find out tomorrow', animations: fadeIn(0, 0.4) }),

      ...ctaBar(18, 7),
      disclaimer(),
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE GRIND — Serial bankroll tracker
// Honest weekly P&L update. Transparency = trust.
// ─────────────────────────────────────────────────────────────────────────────
function buildTheGrind(vars) {
  const { week_num = '1', week_pnl = '+4.2u', running_total = '£1,042',
          wins = 3, losses = 2, bets_text = '5 bets settled this week' } = vars

  const pnlPos = week_pnl.includes('+') || parseFloat(week_pnl) > 0
  const pnlColor = pnlPos ? C.success : C.loss

  return {
    outputFormat: 'mp4', width: 1080, height: 1920, frameRate: 30,
    fillColor: C.bg,
    elements: [
      bg(),

      // ── Header
      txt({ track: 3, time: 0, x: '50%', y: '7.5%', width: '90%', height: 'auto', fontSize: '2.5 vmin', fontWeight: '700', fillColor: C.muted, letterSpacing: 5, text: 'THE GRIND', animations: fadeIn(0, 0.5) }),
      txt({ track: 3, time: 0.3, x: '50%', y: '11.5%', width: '90%', height: 'auto', fontSize: '5.5 vmin', fontWeight: '900', fillColor: C.white, text: `WEEK ${week_num}`, animations: slideUp(0) }),
      shape({ track: 2, time: 0.5, x: '50%', y: '15%', width: '92%', height: '0.15%', fillColor: C.border, animations: fadeIn(0) }),

      // ── W/L badges
      txt({ track: 4, time: 1, x: '50%', y: '19.5%', width: '88%', height: 'auto', fontSize: '2.5 vmin', fontWeight: '600', fillColor: C.muted, text: bets_text, animations: fadeIn(0, 0.5) }),
      shape({ track: 2, time: 1.2, x: '35%', y: '25.5%', width: '28%', height: '8%', fillColor: C.successBg, borderColor: C.success, borderWidth: 1, animations: fadeIn(0, 0.4) }),
      txt({ track: 4, time: 1.3, x: '35%', y: '25.5%', width: '28%', height: 'auto', fontSize: '4 vmin', fontWeight: '900', fillColor: C.success, text: `${wins}W`, animations: fadeIn(0, 0.3) }),
      shape({ track: 2, time: 1.2, x: '65%', y: '25.5%', width: '28%', height: '8%', fillColor: C.lossBg, borderColor: C.loss, borderWidth: 1, animations: fadeIn(0, 0.4) }),
      txt({ track: 4, time: 1.3, x: '65%', y: '25.5%', width: '28%', height: 'auto', fontSize: '4 vmin', fontWeight: '900', fillColor: C.loss, text: `${losses}L`, animations: fadeIn(0, 0.3) }),

      // ── Win/loss bar
      shape({ track: 2, time: 2, x: '7%', y: '33.5%', xAnchor: '0%', width: '86%', height: '1.5%', fillColor: C.lossBg, animations: fadeIn(0, 0.4) }),
      shape({ track: 3, time: 2.2, x: '7%', y: '33.5%', xAnchor: '0%', width: `${Math.round((wins / Math.max(wins + losses, 1)) * 86)}%`, height: '1.5%', fillColor: C.success,
        animations: [{ time: 0, duration: 0.8, type: 'wipe', direction: 'right', easing: 'ease-out' }] }),

      // ── Divider
      shape({ track: 2, time: 2.5, x: '50%', y: '38%', width: '92%', height: '0.15%', fillColor: C.border, animations: fadeIn(0) }),

      // ── Week P&L
      txt({ track: 3, time: 3, x: '50%', y: '43%', width: '88%', height: 'auto', fontSize: '2.3 vmin', fontWeight: '700', fillColor: C.muted, letterSpacing: 4, text: 'WEEK P&L', animations: fadeIn(0, 0.5) }),
      txt({ track: 4, time: 3.2, x: '50%', y: '50%', width: '90%', height: 'auto', fontSize: '12 vmin', fontWeight: '900', fillColor: pnlColor, text: week_pnl,
        animations: [{ time: 0, duration: 0.6, transition: true, type: 'scale', easing: 'ease-out' }] }),

      // ── Divider
      shape({ track: 2, time: 5, x: '50%', y: '58%', width: '92%', height: '0.15%', fillColor: C.border, animations: fadeIn(0) }),

      // ── Running total
      txt({ track: 3, time: 5.5, x: '50%', y: '63%', width: '88%', height: 'auto', fontSize: '2.3 vmin', fontWeight: '700', fillColor: C.muted, letterSpacing: 4, text: 'RUNNING TOTAL', animations: fadeIn(0, 0.5) }),
      txt({ track: 4, time: 5.7, x: '50%', y: '71%', width: '90%', height: 'auto', fontSize: '10 vmin', fontWeight: '900', fillColor: C.white, text: running_total, animations: fadeIn(0, 0.6) }),
      txt({ track: 4, time: 6, x: '50%', y: '77%', width: '88%', height: 'auto', fontSize: '2.5 vmin', fontWeight: '500', fillColor: C.muted, text: 'starting from £1,000 · Kelly sizing', animations: fadeIn(0, 0.5) }),

      ...ctaBar(25, 15),
      disclaimer(),
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. LEAGUE RADAR
// Weekly data journalism: which leagues had the most edges.
// ─────────────────────────────────────────────────────────────────────────────
function buildLeagueRadar(vars) {
  const { week_num = '1', leagues = [], top_league = '' } = vars

  const items = Array.isArray(leagues) ? leagues.slice(0, 6) : []
  const maxCount = Math.max(...items.map(l => l.count || 0), 1)

  // Build league rows (each 8.5% tall, starting at y=30%)
  const leagueRows = items.flatMap((item, i) => {
    const t = 1.5 + i * 0.4
    const y = 30 + i * 9.5
    const barW = `${Math.max(Math.round((item.count / maxCount) * 70), 8)}%`
    const isTop = i === 0
    return [
      // Rank number
      txt({ track: 4, time: t, x: '7%', y: `${y}%`, xAnchor: '0%', width: 'auto', height: 'auto',
        fontSize: '2.8 vmin', fontWeight: '900', fillColor: isTop ? C.orange : C.muted,
        text: `${i + 1}`, animations: fadeIn(0, 0.4) }),
      // League name
      txt({ track: 4, time: t, x: '17%', y: `${y - 1}%`, xAnchor: '0%', width: '55%', height: 'auto',
        fontSize: '2.5 vmin', fontWeight: isTop ? '700' : '500', fillColor: isTop ? C.white : C.muted,
        text: item.league, animations: fadeIn(0, 0.4) }),
      // Edge count
      txt({ track: 4, time: t, x: '93%', y: `${y - 1}%`, xAnchor: '100%', width: 'auto', height: 'auto',
        fontSize: '2.5 vmin', fontWeight: '700', fillColor: isTop ? C.orange : C.muted,
        text: `${item.count} edges`, animations: fadeIn(0, 0.4) }),
      // Bar
      shape({ track: 2, time: t + 0.1, x: '17%', y: `${y + 2}%`, xAnchor: '0%', width: barW, height: '0.8%',
        fillColor: isTop ? C.orange : C.veryMuted,
        animations: [{ time: 0, duration: 0.6, type: 'wipe', direction: 'right', easing: 'ease-out' }] }),
    ]
  })

  return {
    outputFormat: 'mp4', width: 1080, height: 1920, frameRate: 30,
    fillColor: C.bg,
    elements: [
      bg(),

      // ── Header
      txt({ track: 3, time: 0, x: '50%', y: '8%', width: '90%', height: 'auto', fontSize: '3.5 vmin', fontWeight: '700', fillColor: C.orange, letterSpacing: 5, text: 'LEAGUE RADAR', animations: fadeIn(0, 0.5) }),
      txt({ track: 3, time: 0.3, x: '50%', y: '12.5%', width: '88%', height: 'auto', fontSize: '2.5 vmin', fontWeight: '500', fillColor: C.muted, text: `WEEK ${week_num} · VALUE EDGES DETECTED`, letterSpacing: 2, animations: fadeIn(0, 0.5) }),
      shape({ track: 2, time: 0.5, x: '50%', y: '16.5%', width: '92%', height: '0.15%', fillColor: C.border, animations: fadeIn(0) }),

      // ── Column headers
      txt({ track: 3, time: 1, x: '17%', y: '21%', xAnchor: '0%', width: '40%', height: 'auto', fontSize: '1.8 vmin', fontWeight: '600', fillColor: C.veryMuted, letterSpacing: 4, text: 'LEAGUE', animations: fadeIn(0) }),
      txt({ track: 3, time: 1, x: '93%', y: '21%', xAnchor: '100%', width: 'auto', height: 'auto', fontSize: '1.8 vmin', fontWeight: '600', fillColor: C.veryMuted, letterSpacing: 4, text: 'EDGES', animations: fadeIn(0) }),
      shape({ track: 2, time: 1, x: '50%', y: '23%', width: '92%', height: '0.1%', fillColor: C.border, animations: fadeIn(0) }),

      // ── League rows (dynamic)
      ...leagueRows,

      // ── Top league highlight
      ...(top_league ? [
        shape({ track: 2, time: 5, x: '50%', y: '88%', width: '92%', height: '7%', fillColor: C.orangeBg, borderColor: C.orange, borderWidth: 1, animations: fadeIn(0, 0.5) }),
        txt({ track: 4, time: 5.1, x: '50%', y: '88%', width: '88%', height: 'auto', fontSize: '3 vmin', fontWeight: '700', fillColor: C.orange, text: `#1 · ${top_league}`, animations: fadeIn(0, 0.4) }),
      ] : []),

      ...ctaBar(20, 10),
      disclaimer(),
    ]
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
    v.leagues   = v.leagues   || ctxData.leagues
    v.top_league = v.top_league || ctxData.leagues[0]?.league
  }
  if (videoType === 'sharp-vs-square' && ctxData.bets?.length >= 2) {
    const [top, second] = ctxData.bets
    v.match        = v.match        || `${top.home} vs ${top.away}`
    v.public_pick  = v.public_pick  || `${top.home} Win`
    v.public_odds  = v.public_odds  || top.bookmaker?.home?.toFixed(2) || '1.65'
    v.public_implied = v.public_implied || `${Math.round((1/(top.bookmaker?.home||1.65))*100)}%`
    v.ai_pick      = v.ai_pick      || second.bet
    v.ai_odds      = v.ai_odds      || second.bookmaker?.home?.toFixed(2) || '3.40'
    v.ai_prob      = v.ai_prob      || `${second.awayWin || second.homeWin || 35}%`
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
    console.error('  → Then re-run (no --dry-run needed)')
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
    // Show the composition JSON for inspection
    const source = buildSource(type, script.vars || {}, ctx)
    console.log('\n  COMPOSITION PREVIEW (first 3 elements):')
    console.log(JSON.stringify(source.elements.slice(0, 3), null, 2))
    console.log(`\n  Total elements: ${source.elements.length}`)
    console.log(`  Creatomate will auto-detect duration from last element time`)
    console.log('\nDry run complete — no render, no cost.')
    return
  }

  // Optional ElevenLabs voice
  console.log('\nGenerating voiceover...')
  const audioPath = await generateVoiceover(script.voiceover)

  // Build composition with real data
  const source = buildSource(type, script.vars || {}, ctx)

  // If we have a voiceover file, we'd need to host it first (future enhancement)
  // For now Creatomate renders silently — add background music via source property
  if (!audioPath) console.log('  Using silent render (add ELEVENLABS_API_KEY for voiceover)')

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
