# Sample TikTok video — end-to-end production template

This is a full-fidelity walkthrough of one TikTok video so you can see exactly how each script becomes a finished post. **All match names are placeholders** — pull live data from your own /predictions page the day you record. Once you've made one of these, the other 9 follow the same pattern with different data.

**Total production time** (after one-time setup): ~20-30 minutes per video.
**Total duration**: 38 seconds.
**Aspect ratio**: 9:16 (1080×1920).

> ⚠️ **DON'T HARDCODE MATCHES INTO YOUR PROCESS.** A previous version of these docs baked in PSG vs Arsenal as the example. Those matches were already played by the time we noticed. **Always open matchmindcom.com/predictions the morning you record and use whatever's actually live at that moment.**

---

## One-time setup (do this once, never again)

### 1. ElevenLabs account ($5/mo Starter plan)
- Sign up at https://elevenlabs.io
- Library → Voices → **Adam**
- Settings: **Stability 0.55** · **Similarity 0.75** · **Style 0**
- Save as "MatchMind Voice 1"

### 2. Brand intro/outro stings (CapCut, 10 min once)

**Intro sting (1.5s):**
- Black background `#0F1115`
- Orange "M" appears centred
- "AI FOOTBALL INTELLIGENCE" tracked text underneath
- 0.3s fade in, 1s hold, 0.2s fade out
- Save as CapCut template: "MatchMind Intro"

**Outro card (2s):**
- Same black background
- White text: "matchmindcom.com/world-cup"
- Orange text below: "link in bio →"
- Save as: "MatchMind Outro"

### 3. Corner watermark
- @match.mindai in low-opacity white (40%), bottom-right
- Save as CapCut sticker preset, drag onto every video

---

## Step 1 — Pull the data (do this every recording, takes 60 seconds)

Open https://www.matchmindcom.com/predictions in your browser.

Pick **one** of the top 3 +EV picks. Note down:
- Match: `[HOME TEAM] vs [AWAY TEAM]`
- League: `[LEAGUE NAME]`
- Pick: `[MARKET]` (e.g. "Over 2.5 goals", "BTTS Yes", "Home Win")
- Odds: `[X.XX]`
- EV: `+[N]%`
- Why (read the reasoning): pick 3 concrete data points the model used

If `/predictions` has no future picks (cache empty or in a gap), DON'T record. Skip the day.

---

## Step 2 — Record the screen (3 min)

Use Screen Studio (Mac) or QuickTime → Screen Recording.

- Open https://www.matchmindcom.com/predictions in mobile width (Safari → Develop → Responsive → iPhone 15 Pro)
- Scroll the page slowly until you see your chosen pick
- Hover/zoom into:
  - The match name + league badge
  - The +EV badge (orange)
  - The AI probability vs market probability
  - The "best value" pick row
- Total recording length: 15-20 seconds

Save as `screen-record.mp4`.

---

## Step 3 — Generate the voiceover (2 min)

Paste this into ElevenLabs (replace brackets with your live data):

```
Tonight's biggest mispricing. [LEAGUE NAME]. [HOME TEAM] versus [AWAY TEAM]. The bookies have [MARKET] at [ODDS]. They think it'll be tight. The model disagrees. Three signals are flashing. [DATA POINT 1]. [DATA POINT 2]. And [DATA POINT 3]. Combined edge — [N] percent. The match is on the site now. Free.
```

Download as `voiceover.mp3`.

**Tone tips for ElevenLabs**:
- Use periods, not commas, between beats — gives Adam time to breathe
- Numbers: spell them out ("two point oh five" not "2.05") for cleaner pronunciation
- Acronyms (UCL, EPL): spell them out ("Champions League", "Premier League")

---

## Step 4 — Grab B-roll (3 min)

https://www.pexels.com/search/videos/football and https://pixabay.com/videos/search/football

Download 4 short clips that fit your match's vibe:
- 3s of stadium atmosphere
- 2s of crowd reaction
- 2s of close-up boots / ball
- 2s of generic football action

No attribution needed for Pexels/Pixabay. Save to a `b-roll/` folder.

---

## Step 5 — Assemble in CapCut (15 min)

New project → 9:16 TikTok preset.

```
0.0s  ─ [MatchMind Intro sting] ────────────── 1.5s
1.5s  ─ Text: "BOOKIES PRICED THIS WRONG" ──── 1.5s
3.0s  ─ Screen recording — your pick on /predictions ─ 7s
10.0s ─ B-roll: stadium (3s) + crowd (2s) ──── 5s
15.0s ─ Text: "[HOME] vs [AWAY] — [MARKET] @ [ODDS]" ─ 3s
18.0s ─ B-roll: boots/ball (2s)
20.0s ─ Three text cards synced to VO data points:
        - "[DATA POINT 1]" (3s)
        - "[DATA POINT 2]" (3s)
        - "[DATA POINT 3]" (3s)
29.0s ─ HUGE text: "+[N]% EDGE" (orange) ──── 4s
33.0s ─ B-roll: action shot (2s)
35.0s ─ Text: "Free in bio →" ─────────────── 1s
36.0s ─ [MatchMind Outro card] ─────────────── 2s
38.0s ─ END
```

**Audio:**
- Track 1: `voiceover.mp3` at 3.0s
- Track 2: low cinematic music (CapCut "Tension Build") at 30% volume
- Track 3: cash-register sound at 29.0s when "+[N]% EDGE" hits

**Visuals:**
- Font: Inter Bold or Montserrat Black
- Cream `#F5F1E8` text, orange `#F97316` for numbers / key beats
- 4px black drop shadow at 40% opacity
- Watermark @match.mindai bottom-right every frame
- 6-frame punch-in (scale 100→105%) on every cut for kinetic feel

---

## Step 6 — Export + post (5 min)

- Export 1080×1920 @ 30fps, "High" quality
- Open TikTok mobile → Upload
- Caption template: `[HOME] vs [AWAY] — the bookies are wrong. AI says [MARKET] @ [ODDS], +[N]% edge. Full reasoning in bio. #[LEAGUE_HASHTAG] #footballbetting #valuebets #aibetting`
- Cover image: frame with "+[N]% EDGE" in orange
- Description: "Link in bio"
- Post

**Within 5 minutes of posting**, self-comment:
> "Same model drops a daily acca — link in bio gets you tomorrow's free during the World Cup."

The self-comment is the highest-leverage TikTok action — pushes you out of cold-start.

---

## Brand reference

Visit https://www.matchmindcom.com/api/og/tiktok-sample for the 1080×1920 reference frame. Match its exact colors, sizes, and the orange-hero-number style on every overlay.

---

## What to do if it underperforms

- **<500 views at 24h**: cold-start failed. Re-cut first 2s with the "+N% EDGE" big orange number FIRST instead of text.
- **500-5000 views**: normal cold start. Post tomorrow's. Algorithm needs 3-5 videos to calibrate.
- **5000+ views**: format works. Recycle for next 3 posts with different picks.

## What to NEVER include

- Your face or voice (use ElevenLabs)
- Real-money screenshots of your own bets
- Bookmaker affiliate codes
- "Guaranteed" / "100% sure" language (ASA UK rules + instant ban risk)
- Emoji-stuffed captions (algorithm penalises)

## The cardinal rule

**Match data must be live the day you record.** Open /predictions on the morning of, pull from there, never reuse a previous video's match. Stale data on TikTok = "this guy's a scammer" instantly.
