# MatchMind Instagram growth plan — pre-WC + WC ramp

> Captured 2026-06-05. 6 days to WC kickoff (Jun 11).
> Source: competitor analysis of @footballodds.io, @statengine_,
> @kick.sharp, plus the SideSweep ad pattern.

## Competitor analysis

### @statengine_ — the winner of the four

**What they're doing right:**
- **Distinctive brand palette** — navy + lime green. Instantly recognisable on the grid. We have orange/cream which is good but inconsistent.
- **Educational infographic dominance** — "BTTS quick checklist", "STRONG AT HOME, WEAK AWAY", "BEST ANGLES Mexico vs South Africa". These get saves, not just likes. Algorithm rewards saves more than likes.
- **Trust-building content** — "WHY WE DON'T OFFER BOOKIE LINKS" + "Safer Guide to Gambling" as a pinned post. Positions them as the honest alternative.
- **Pinned WC content** — "FREE WORLD CUP ACCESS · 104 GAMES INCLUDED". Top-row real estate.
- **Bold typography hierarchy** — every post has a 3-5 word headline that reads from the grid.
- **Stadium backgrounds** subtly in every post — keeps it sports-feeling.

**What we can lift directly:**
1. Educational infographic format ("Why we don't…", "Quick checklist…")
2. Pinned trust posts + pinned WC offer
3. Stadium-background design system

### @kick.sharp — the closest competitor

**What they're doing right:**
- **Value bet cards with edge%** — "Mexico Win +5.7% EDGE / Implied 71% / Conf 77%". Our cron produces exactly this data — we just don't post it.
- **Reels with stadium footage + bold WC2026 overlay** — gets play counts, not just likes.
- **Phone-mockup posts** showing the app. Builds product credibility.
- **Player photos** (Vinicius Jr, Bruno Fernandes) with team branding. This is borderline-legal (player likeness rights) but gets engagement.
- **"Slip of the Day"** feature — daily ritual. Followers come back for it.

**What we can lift directly:**
1. Daily value-bet card (same data, our branding)
2. Stadium-footage reel with text overlay
3. Phone-mockup posts (we have a beautiful dashboard already)
4. Daily ritual: "MatchMind Daily Slip" — could even just be the existing tonight-acca cron output exported as IG image

**Where they're WEAKER than us:**
- Win rate not public
- Track record not transparent
- We have 500+ picks tracked, they show none

### @footballodds.io — early-stage, useful template

**What they're doing right:**
- **Purple gradient** + dark — premium feel
- **"Most predictable teams"** post is genius — ranks teams by AI hit rate (Bayern 80.7%, PSG 80.3%). High share value, evergreen content.
- **Player profile cards** (Lewandowski 75% on Anytime Goal Scorer). Specific, named, datapoint-led.

**What we can lift directly:**
1. "Most predictable teams in [league]" weekly post — we have the data
2. Per-player AI confidence cards — needs lineup data which we have

### SideSweep ad — visual energy benchmark

Not a direct competitor (sweepstake app) but the design is loud:
- Bold yellow/black contrast
- Confetti + soccer ball graphics
- Phone mockup
- Multiple CTAs in one post (App Store, Play Store, "Search SIDESWEEP APP TODAY!")

We won't copy the loudness — it doesn't fit our anti-hype brand — but the **graphic energy** is the target. Our posts shouldn't look like static screenshots; they should look like designed assets.

---

## Pattern extraction — what to copy, what to skip

### COPY:
| Pattern | Why | Our version |
|---|---|---|
| Educational infographic | High save rate → algorithm boost | "Why we don't tell you who to bet on", "Value-bet maths in 30 seconds" |
| Match-day value card | Daily ritual = retention | Use existing post-tonight-acca data |
| Phone mockup with real dashboard | Product credibility | Screenshot from /dashboard or /world-cup/teams/[any team] |
| Stadium-background design system | Cohesive grid identity | New design template |
| Pinned WC offer | First impression | "Free WC predictions every morning" pinned post |
| Trust/compliance post | Brand differentiation | "Why we publish every loss" — we have 500 picks proof |

### SKIP:
- Player photos without licence (legal risk + we don't have permission)
- "Edge %" with fake/inflated numbers (our +10% max is honest, looks lower than KickSharp's +5.7% but that's not really 5.7% net)
- Bookie affiliate links (matches our brand)
- Generic "BIG GAME TODAY" hype posts

---

## The 17-day plan — pre-WC + group stage

**Posting cadence:** 1 IG post/day + 2-3 stories. Target by 23:00 BST. Use existing brand: dark `#0F1115` bg, orange `#F97316` accent, cream `#F5F1E8` foreground.

### Pre-WC (Jun 6 – 10) · 5 days
| Date | Post type | Content |
|---|---|---|
| Fri 6 Jun | Pinned: **"FREE WC PICKS — 104 GAMES"** | Mirrors @statengine_'s pinned format. Headline + brand + bio CTA. |
| Sat 7 Jun | Value-bet card | Top +EV pick from tomorrow's friendlies, branded MatchMind |
| Sun 8 Jun | "Most predictable teams" infographic | Rank top 6 teams by our AI hit rate across all leagues. Saveable. |
| Mon 9 Jun | **"Why we publish every loss"** infographic | Our anti-hype proof. 500 picks · 43% win rate · -0.1% ROI · "every result public". |
| Tue 10 Jun | WC bracket reveal | Branded version of /world-cup/bracket page — 12 groups, all 48 teams. Carousel post. |

### WC opening week (Jun 11 – 17) · 7 days
| Date | Post type | Content |
|---|---|---|
| Wed 11 Jun | **"World Cup is LIVE"** + Mexico v South Africa value card | The opening match. Lead with our pick + EV. |
| Thu 12 Jun | Daily slip carousel | 2-3 value bets from matchday, swipeable |
| Fri 13 Jun | Match preview infographic | Pick one big match (e.g. Türkiye v Australia) — form for both, our angle, key stat. Statengine-style. |
| Sat 14 Jun | "Yesterday's results" recap | W/L grid with profit/loss, ratchet up the trust signal |
| Sun 15 Jun | Match preview #2 | Another deep-dive infographic |
| Mon 16 Jun | "Week 1 in numbers" | Our W/L for the week + ROI |
| Tue 17 Jun | Player spotlight | Top scorer through Week 1 (API-Football data) — no photo, just name + team + stats |

### WC group stage tail (Jun 18 – 22) · 5 days
| Date | Post type | Content |
|---|---|---|
| Wed-Fri | Daily slip + 1 deep-dive | Same cadence |
| Sat | "Round of 32 picture" | Who's qualified, who's out, our knockout predictions |
| Sun | Major matchup carousel | The big knockout fixtures lined up |

---

## What I can ship for you automatically

The existing OG infrastructure (`/api/og/wc-team`, `/api/og/wc-fixture`, `/api/og/pick`) already produces 1200×630 cards. For Instagram I need **1080×1350** (4:5) or **1080×1080** (square). Quick rebuild gets us:

1. **`/api/og/ig-value-card?fixture=X`** — daily value-bet IG post
   - Big team-vs-team header
   - AI Pick · Odds · EV
   - "Logged before kick-off · matchmindcom.com"
   - Auto-generated from today's predictions

2. **`/api/og/ig-recap?date=X`** — daily W/L recap
   - W/L grid for the day
   - Net P&L
   - Branded MatchMind

3. **`/api/og/ig-team-stats?slug=X`** — "most predictable teams" infographic
   - Top 6 teams ranked by hit rate
   - Stadium background
   - Save-worthy

4. **`/api/og/ig-bracket`** — WC bracket carousel slide
   - 12 groups in a clean grid
   - All 48 teams

Each auto-updates with live data. You post the URL → IG image, no design work per post.

For the **educational infographics** ("Why we publish every loss", "Value-bet maths in 30s") — those need a one-time design pass since they're evergreen, not data-driven. I can ship those as static images too.

---

## Posting workflow

**Daily:**
1. Cron at 17:00 UTC posts to Twitter (already running)
2. Cron at 17:30 UTC posts to IG (already running, but the IG card is the old `/api/og/acca`)
3. Replace the IG card source with `/api/og/ig-value-card` once built

**Manual (~5 min/day):**
- Pick the day's IG type from this schedule
- If it's a static infographic, download → upload manually
- Stories: 2-3 screenshots from /dashboard with sticker overlays

---

## What to do this week

1. **Today**: ship the 4 new IG-format OG endpoints (~2 hours work). I can do this now.
2. **Friday**: post the pinned "Free WC Picks" post (manual upload via IG app)
3. **Sat-Mon**: 3 daily posts via the new automated endpoints
4. **Tue**: WC bracket carousel
5. **Wed Jun 11**: WC kicks off — automation goes daily

Want me to start building the IG-format OG endpoints? Same approach as the WC cards but 4:5 aspect ratio. Roughly 90 minutes of work for all 4 templates.
