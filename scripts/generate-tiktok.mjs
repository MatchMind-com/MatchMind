/**
 * generate-tiktok.mjs — MatchMind TikTok Video Pipeline
 *
 * Pulls live prediction data → generates GPT script → renders via Creatomate
 * → downloads MP4 to ~/Desktop/MatchMind TikTok Queue/POST_[date]_[type].mp4
 *
 * Usage:
 *   node scripts/generate-tiktok.mjs edge-scanner
 *   node scripts/generate-tiktok.mjs odds-autopsy
 *   node scripts/generate-tiktok.mjs sharp-vs-square
 *   node scripts/generate-tiktok.mjs the-grind
 *   node scripts/generate-tiktok.mjs league-radar
 *   node scripts/generate-tiktok.mjs edge-scanner --dry-run   (no render, no cost)
 *
 * Setup (one-time):
 *   1. npm install @supabase/supabase-js openai dotenv node-fetch
 *   2. Add CREATOMATE_API_KEY to .env.local  (creatomate.com)
 *   3. Add ELEVENLABS_API_KEY to .env.local  (optional — elevenlabs.io)
 *   4. Create Creatomate templates (see TEMPLATE_IDS below) and paste the IDs
 *
 * Posting schedule (best engagement for UK betting audience):
 *   edge-scanner    → daily    17:00 UK  (before evening fixtures)
 *   odds-autopsy    → Tue/Thu/Sat 12:00 UK
 *   sharp-vs-square → daily    09:00 UK  (morning line check)
 *   the-grind       → Monday   10:00 UK  (weekly recap)
 *   league-radar    → Sunday   18:00 UK  (week ahead)
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { readFileSync } from 'fs'

// ── Env ─────────────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  } catch { /* .env.local is optional */ }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY   = process.env.OPENAI_API_KEY
const CREATOMATE_KEY = process.env.CREATOMATE_API_KEY
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY  // optional

// ── Creatomate template IDs ──────────────────────────────────────────────────
// Create each template in your Creatomate dashboard (creatomate.com/templates)
// 9:16 vertical, 1080x1920, 30s max. Paste the template UUID here.
// See /docs/creatomate-templates.md for design specs per format.

const TEMPLATE_IDS = {
  'edge-scanner':    'PASTE_TEMPLATE_ID_HERE',
  'odds-autopsy':    'PASTE_TEMPLATE_ID_HERE',
  'sharp-vs-square': 'PASTE_TEMPLATE_ID_HERE',
  'the-grind':       'PASTE_TEMPLATE_ID_HERE',
  'league-radar':    'PASTE_TEMPLATE_ID_HERE',
}

// ── ElevenLabs voice ID ──────────────────────────────────────────────────────
// Pick a voice from elevenlabs.io/voice-library. Consistent voice = brand identity.
// Suggestion: "Daniel" (British male, authoritative) or "George" (UK accent)
const ELEVENLABS_VOICE_ID = 'YOUR_VOICE_ID_HERE'

// ── CLI ──────────────────────────────────────────────────────────────────────

const VALID_TYPES = Object.keys(TEMPLATE_IDS)
const type = process.argv[2]
const dryRun = process.argv.includes('--dry-run')

if (!type || !VALID_TYPES.includes(type)) {
  console.error(`Usage: node scripts/generate-tiktok.mjs <type> [--dry-run]`)
  console.error(`Types: ${VALID_TYPES.join(' | ')}`)
  process.exit(1)
}

// ── Supabase ─────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Predictions are stored as JSON payloads in predictions_by_league.
// Each row's payload is an array of predictions for that league.
// ev field is an object: { home: 5, away: -1, draw: -3, over25: 26, ... }

function bestEv(evObj) {
  if (!evObj || typeof evObj !== 'object') return 0
  return Math.max(...Object.values(evObj).filter(v => typeof v === 'number'))
}

async function getAllPredictions() {
  const { data, error } = await supabase
    .from('predictions_by_league')
    .select('payload')
    .order('generated_at', { ascending: false })
  if (error) throw new Error(`Supabase error: ${error.message}`)
  const all = []
  for (const row of data || []) {
    const picks = Array.isArray(row.payload) ? row.payload : []
    all.push(...picks)
  }
  return all
}

async function getTopValueBets(limit = 5) {
  const all = await getAllPredictions()
  return all
    .filter(p => p.is_value_bet)
    .sort((a, b) => bestEv(b.ev) - bestEv(a.ev))
    .slice(0, limit)
    .map(p => ({
      home_team: p.home_team,
      away_team: p.away_team,
      league: p.league,
      date: p.date,
      recommended_bet: p.recommended_bet,
      recommended_odds_range: p.recommended_odds_range,
      confidence: p.confidence,
      risk_level: p.risk_level,
      home_win_pct: p.home_win_pct,
      draw_pct: p.draw_pct,
      away_win_pct: p.away_win_pct,
      btts_pct: p.btts_pct,
      over_2_5_pct: p.over_2_5_pct,
      best_ev: bestEv(p.ev),
      ev_detail: p.ev,
      pinnacle_edge: p.pinnacle_edge,
      bookmaker_odds: p.bookmaker,
    }))
}

async function getWeeklyStats() {
  const all = await getAllPredictions()
  return all
    .filter(p => p.is_value_bet)
    .map(p => ({ league: p.league, best_ev: bestEv(p.ev), recommended_bet: p.recommended_bet }))
}

async function getTrackRecord() {
  const { data } = await supabase
    .from('bet_slips')
    .select('result,profit_loss,stake,odds,home_team,away_team,market,selection')
    .in('result', ['win', 'loss'])
    .order('created_at', { ascending: false })
    .limit(50)
  return data || []
}

// ── Script generators ────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: OPENAI_KEY })

async function generateScript(videoType, contextData) {
  const systemPrompts = {
    'edge-scanner': `You write TikTok video scripts for MatchMind — a football AI that finds value bets by detecting when bookmakers misprice odds. Tone: direct, data-led, no hype. No guaranteed wins. Max 55 spoken words. End with "Full analysis at matchmind.com" or "Link in bio". Always add "18+ Bet Responsibly" as a text overlay note (not spoken).`,

    'odds-autopsy': `You write TikTok scripts that forensically dissect ONE football market — showing how a bookmaker priced it, the true probability, the margin, and the edge. Educational tone but punchy. Max 55 spoken words. Think data journalism, not tipster content.`,

    'sharp-vs-square': `You write TikTok scripts comparing what casual bettors are backing vs what MatchMind AI is actually flagging as value. Two-panel format: public favourite vs the AI's pick. Reveal the divergence. No hype. Max 50 words spoken.`,

    'the-grind': `You write weekly TikTok update scripts tracking a virtual £1000 bankroll using MatchMind's actual track record. Show the running total, this week's bets, P&L. Honest — include losses. Tone: calm, confident, long-game mentality. Max 60 spoken words.`,

    'league-radar': `You write weekly TikTok scripts revealing which football leagues had the most AI-detected value this week (mispriced markets). Rank them. Data journalism tone. Max 55 spoken words.`,
  }

  const userContent = {
    'edge-scanner': `Today's top value bets from MatchMind AI:\n${JSON.stringify(contextData.bets, null, 2)}\n\nWrite a script for the "Edge Scanner" format: dark UI aesthetic, radar locks on to the best edge. Reveal the #1 value bet with its AI probability vs bookmaker implied probability and EV%.`,

    'odds-autopsy': `Today's top value bet:\n${JSON.stringify(contextData.bets?.[0], null, 2)}\n\nWrite an "Odds Autopsy" script. Break down this specific market forensically: show the bookmaker's implied probability, MatchMind's true probability estimate, the margin, and why this is a positive EV selection. Make it feel like a crime scene investigation into bad odds.`,

    'sharp-vs-square': `Today's predictions:\n${JSON.stringify(contextData.bets, null, 2)}\n\nWrite a "Sharp vs Square" script. Pick the most interesting divergence: one match where casual bettors are likely backing the obvious choice but MatchMind AI is flagging a different selection as value. Left panel = public pick. Right panel = AI pick.`,

    'the-grind': `This week's resolved bets from track record:\n${JSON.stringify(contextData.track, null, 2)}\n\nWrite "The Grind" weekly update. Calculate this week's P&L from the data. Running total from 50 recent bets. Honest — show wins AND losses. Emphasise the long-game, positive EV approach.`,

    'league-radar': `This week's value bets by league:\n${JSON.stringify(contextData.weekly, null, 2)}\n\nWrite a "League Radar" script. Group by league, count value bets found per league, rank them. The angle: shows where the inefficiencies in the market are this week.`,
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.7,
    messages: [
      { role: 'system', content: systemPrompts[videoType] },
      { role: 'user', content: `${userContent[videoType]}\n\nReturn JSON:\n{\n  "voiceover": "...",\n  "scenes": [\n    { "id": 1, "duration": 5, "visual": "...", "text_overlay": "..." },\n    ...\n  ],\n  "template_variables": { "match": "...", "ai_prob": "...", "bk_prob": "...", "ev": "...", "bet_type": "..." }\n}` },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 600,
  })

  return JSON.parse(completion.choices[0].message.content)
}

// ── ElevenLabs voiceover ─────────────────────────────────────────────────────

async function generateVoiceover(text, outputPath) {
  if (!ELEVENLABS_KEY || ELEVENLABS_KEY === 'YOUR_API_KEY') {
    console.log('  ElevenLabs not configured — Creatomate will use built-in TTS')
    return null
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
    }),
  })

  if (!res.ok) {
    console.warn(`  ElevenLabs failed (${res.status}) — falling back to built-in TTS`)
    return null
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(outputPath, buffer)
  console.log(`  Voiceover saved: ${path.basename(outputPath)}`)
  return outputPath
}

// ── Creatomate render ────────────────────────────────────────────────────────

async function renderVideo(templateId, modifications) {
  const res = await fetch('https://api.creatomate.com/v1/renders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CREATOMATE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_id: templateId,
      modifications,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Creatomate error ${res.status}: ${err}`)
  }

  const renders = await res.json()
  return renders[0]
}

async function pollRender(renderId, timeoutMs = 120_000) {
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
  throw new Error('Render timed out after 2 minutes')
}

async function downloadFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(destPath, buffer)
}

// ── Suggested post date ──────────────────────────────────────────────────────

function suggestedPostDate(videoType) {
  const now = new Date()
  const schedules = {
    'edge-scanner':    { hour: 17, minute: 0 },
    'odds-autopsy':    { hour: 12, minute: 0 },
    'sharp-vs-square': { hour: 9,  minute: 0 },
    'the-grind':       { hour: 10, minute: 0 },
    'league-radar':    { hour: 18, minute: 0 },
  }
  const { hour, minute } = schedules[videoType]
  const d = new Date(now)
  d.setHours(hour, minute, 0, 0)
  if (d <= now) d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 16).replace('T', '_').replace(':', 'h') + '_UK'
}

// ── Output path ──────────────────────────────────────────────────────────────

function outputPath(videoType, postDate) {
  const dir = path.join(os.homedir(), 'Desktop', 'MatchMind TikTok Queue')
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `POST_${postDate}_${videoType}.mp4`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nMatchMind TikTok Pipeline — ${type}${dryRun ? ' (DRY RUN)' : ''}\n`)

  // Validate API keys
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase credentials in .env.local'); process.exit(1) }
  if (!OPENAI_KEY)   { console.error('Missing OPENAI_API_KEY in .env.local'); process.exit(1) }
  if (!dryRun && (!CREATOMATE_KEY || CREATOMATE_KEY === 'PASTE_KEY_HERE')) {
    console.error('Missing CREATOMATE_API_KEY in .env.local')
    console.error('Sign up at creatomate.com — $99/mo covers 50 renders/day')
    console.error('Tip: use --dry-run to test without rendering')
    process.exit(1)
  }
  if (!dryRun && TEMPLATE_IDS[type] === 'PASTE_TEMPLATE_ID_HERE') {
    console.error(`Template ID not set for "${type}"`)
    console.error('Create the template in Creatomate dashboard and paste the ID into TEMPLATE_IDS in this script')
    process.exit(1)
  }

  // Fetch context data
  console.log('Fetching data from Supabase...')
  const contextData = {}
  if (['edge-scanner', 'odds-autopsy', 'sharp-vs-square'].includes(type)) {
    contextData.bets = await getTopValueBets(5)
    if (!contextData.bets.length) { console.error('No value bets found for today. Check if predictions cron has run.'); process.exit(1) }
    console.log(`  ${contextData.bets.length} value bets loaded`)
  }
  if (type === 'the-grind') {
    contextData.track = await getTrackRecord()
    console.log(`  ${contextData.track.length} resolved bets loaded`)
  }
  if (type === 'league-radar') {
    contextData.weekly = await getWeeklyStats()
    console.log(`  ${contextData.weekly.length} this week's value bets loaded`)
  }

  // Generate script
  console.log('Generating script with GPT-4o...')
  const script = await generateScript(type, contextData)
  console.log('\n--- VOICEOVER ---')
  console.log(script.voiceover)
  console.log('\n--- SCENES ---')
  script.scenes?.forEach(s => console.log(`  [${s.id}] ${s.duration}s — ${s.visual}`))
  console.log('\n--- TEMPLATE VARS ---')
  console.log(JSON.stringify(script.template_variables, null, 2))

  if (dryRun) {
    console.log('\nDry run complete. No video rendered.')
    return
  }

  // Optional ElevenLabs voiceover
  const tmpAudio = path.join(os.tmpdir(), `matchmind_tiktok_${Date.now()}.mp3`)
  const audioPath = await generateVoiceover(script.voiceover, tmpAudio)

  // Build Creatomate modifications from script output
  const modifications = {
    ...script.template_variables,
    voiceover: script.voiceover,
    // If ElevenLabs audio was generated, pass it as a URL would require hosting.
    // For now, Creatomate uses its built-in TTS with the voiceover text.
  }

  // Render
  console.log('\nRendering video with Creatomate...')
  const render = await renderVideo(TEMPLATE_IDS[type], modifications)
  console.log(`  Render ID: ${render.id} — polling for completion`)
  process.stdout.write('  ')
  const completed = await pollRender(render.id)
  console.log('\n  Render complete')

  // Download
  const postDate = suggestedPostDate(type)
  const dest = outputPath(type, postDate)
  console.log(`\nDownloading to ${dest}...`)
  await downloadFile(completed.url, dest)

  // Clean up temp audio
  if (audioPath && fs.existsSync(tmpAudio)) fs.unlinkSync(tmpAudio)

  console.log(`\nDone.`)
  console.log(`File: ${path.basename(dest)}`)
  console.log(`Path: ${dest}`)
  console.log(`Suggested post time: ${postDate.replace('_', ' ').replace('h', ':').replace('_UK', ' UK')}`)
  console.log(`\nReview the video before posting. 18+ Bet Responsibly.`)
}

main().catch(err => {
  console.error('\nPipeline error:', err.message)
  process.exit(1)
})
