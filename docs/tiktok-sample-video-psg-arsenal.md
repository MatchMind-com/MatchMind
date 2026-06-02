# Sample video — Script 1, PSG v Arsenal, end-to-end production

This is a full-fidelity walk-through of one TikTok video so you can see exactly how each anonymous script becomes a finished post. Once you've made this one, the other 9 are the same pattern with different data.

**Total production time** (after one-time setup): ~20-30 minutes.
**Total duration**: 38 seconds.
**Aspect ratio**: 9:16 (1080×1920).

---

## One-time setup (do this once, never again)

### 1. ElevenLabs account ($5/mo Starter plan)

1. Sign up at https://elevenlabs.io
2. Library → Voices → **Adam** (default)
3. Settings: **Stability 0.55** · **Similarity 0.75** · **Style 0**
4. Save your voice as "MatchMind Voice 1" in your profile
5. *Optional but recommended*: pay $11/mo Creator plan if you produce >10 videos/month (cheaper per-minute)

### 2. Brand intro/outro stings (CapCut, 10 min)

Create two reusable templates:

**Intro sting (1.5s):**
- Black background `#0F1115`
- Orange "M" appears centred (use the same logo from your site favicon — `app/manifest.ts` or `public/icon-1024.png`)
- Below: "AI FOOTBALL INTELLIGENCE" in white tracked letterspacing
- 0.3s fade-in, 1s hold, 0.2s fade-out
- Save as CapCut template: "MatchMind Intro"

**Outro card (2s):**
- Same black background
- White text: "matchmindcom.com/world-cup"
- Orange text below: "link in bio →"
- Save as: "MatchMind Outro"

After this is set up, you drag both onto every video without thinking.

### 3. Corner watermark

In CapCut, save a sticker preset of `@match.mindai` in low-opacity white (40% alpha), positioned bottom-right. Drag onto every video.

---

## Production checklist for THIS video (PSG v Arsenal)

### Step 1 — Record the screen recording (3 min)

What to record (use Screen Studio on Mac or QuickTime → screen recording):

- Open https://www.matchmindcom.com/predictions in **mobile browser size** (1080 wide). On Mac: Safari → Develop → Enter Responsive Design Mode → set to iPhone 15 Pro.
- Scroll the page slowly until you see the PSG v Arsenal card
- Hover/zoom into:
  - The match name + league badge
  - The +EV badge (orange)
  - The AI probability vs market probability
  - The "best value" pick (Over 2.5 @ 2.05)
- Total recording length: 15-20 seconds.

Save as `psg-arsenal-screenrecord.mp4`.

### Step 2 — Generate the voiceover (2 min)

Open ElevenLabs → Speech Synthesis → paste this exact text into your saved "Adam" voice:

```
Tonight's biggest mispricing. Champions League. PSG versus Arsenal. The bookies have Over two point five goals at two oh five. They think it'll be tight. The model disagrees. Three signals are flashing. PSG's home expected goals over the last five matches. Arsenal's away defensive form since the international break. And a referee who averages three point one goals per game in big European nights. Combined edge — twenty three percent. The match is on the site now. Free.
```

(~35 seconds at default speed.) Download as `psg-arsenal-vo.mp3`.

### Step 3 — Grab B-roll (3 min)

Open https://www.pexels.com/search/videos/champions%20league + https://pixabay.com/videos/search/football%20stadium

Download these 4 clips (free, no attribution needed):
- 3s of Champions League stadium at night
- 2s of football crowd reacting
- 2s of a goal being scored (any)
- 2s of close-up boots on grass

Save to a folder `b-roll/`.

### Step 4 — Assemble in CapCut (15 min)

Open CapCut → New Project → 9:16 (TikTok preset).

Timeline:

```
0.0s  ─ [MatchMind Intro sting] ──────────── 1.5s
1.5s  ─ Text card: "BOOKIES PRICED THIS WRONG" ─ 1.5s
3.0s  ─ Screen recording — scroll predictions page ─ 7s
10.0s ─ B-roll: CL stadium (3s) + crowd (2s) ─ 5s
15.0s ─ Text card: "PSG VS ARSENAL — OVER 2.5 @ 2.05" ─ 3s
18.0s ─ B-roll: boots on grass (2s)
20.0s ─ Text cards (synced to VO):
        - "PSG XG ↑" (3s)
        - "ARSENAL XGA ↑" (3s)
        - "REF 3.1g/MATCH" (3s)
29.0s ─ HUGE text card: "+23% EDGE" (orange) ─ 4s
33.0s ─ B-roll: goal cut (2s)
35.0s ─ Text card: "Free in bio →" ─ 1s
36.0s ─ [MatchMind Outro card] ──────────── 2s
38.0s ─ END
```

**Audio tracks:**
- Track 1 (voiceover): `psg-arsenal-vo.mp3`, starts at 3.0s
- Track 2 (music): CapCut's "Tension Build" or any low cinematic drone, 30% volume
- Track 3 (sting): Cash-register sound at 29.0s when "+23% EDGE" hits

**Visual settings:**
- All text overlays: font **Inter Bold** or **Montserrat Black**
- Cream colour `#F5F1E8` for normal text, orange `#F97316` for stat numbers/key beats
- Drop shadow: 4px, black, 40% opacity (makes text legible on any background)
- Watermark sticker @ bottom-right corner

**One small thing that matters disproportionately:** add a subtle 1-frame "punch in" (scale 100% → 105% over 6 frames) every time you cut to a new clip. CapCut has this as "Bounce In" preset. Makes the edit feel kinetic.

### Step 5 — Export + post (5 min)

- Export 1080×1920 at 30fps, "High" quality. ~20MB file.
- Open TikTok mobile app → Upload → select the .mp4
- **Caption**: `PSG vs Arsenal — the bookies are wrong. AI says O2.5 @ 2.05, +23% edge. Full reasoning in bio. #championsleague #footballbetting #valuebets #aibetting #psg #arsenal`
- Cover image: pick the frame with "+23% EDGE" in orange — that's your scroll-stopper in the For You feed
- Description: "Link in bio"
- Tap **Post**

**Within 5 minutes of posting**, comment on your own video with:
> "Same model also drops a daily acca — link in bio gets you tomorrow's free during the World Cup."

The self-comment is the highest-leverage TikTok action. It pushes your video out of the cold-start algorithm and bumps it into engagement-driven reach.

---

## The brand frame I rendered for you

I built `/api/og/tiktok-sample` that generates a 1080×1920 vertical PNG showing exactly what your brand frame should look like — title, stat, watermark, brand colours.

Open it: https://www.matchmindcom.com/api/og/tiktok-sample

Use it as the **visual reference** when building text overlays in CapCut. Match these exact colors, sizes, and spacing on every video. Brand consistency over 10 videos is what will replace your face as the recognition signal.

---

## What to do if this video underperforms

If after 24h it has <500 views, the cold-start algorithm didn't like the hook. Options:
1. **Re-cut the first 2 seconds** — try opening with the "+23% EDGE" big orange number instead of text
2. **Try Format B** (text-only + trending sound, no voiceover) — sometimes the sound carries it
3. **Test a different voice** in ElevenLabs — Antoni instead of Adam can land warmer

If after 24h it has 500-5000 views — that's normal cold start. Post the next script tomorrow, the algorithm needs 3-5 videos to learn what to do with your account.

If after 24h it has 5000+ views — congrats, you're on the right track. Recycle the format (replace PSG with whatever's high-EV that day) for at least the next 3 posts.

## What this video should NOT include

- Your face, voice (use ElevenLabs), or any personal identifier
- Real-money screenshots of your own bets (looks unverified)
- Bookmaker links or affiliate codes (TikTok suppresses + your account gets flagged for gambling promotion)
- Promises ("guaranteed win", "100% sure") — instant ban risk + violates ASA UK rules
- Emoji-stuffed captions — TikTok 2025 algorithm penalises spam-emoji captions

## Final note

The first 3-5 anonymous videos will feel uncomfortable to make because there's no "you" in them — just brand + data + AI voice. That's normal. By video 6 you'll have the workflow muscle-memory and each one takes 15 mins not 45. By video 10, viewers will recognise the brand on sight.

The bio link is the one thing that converts. Every video exists to send people there.
