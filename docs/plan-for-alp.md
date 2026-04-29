# MatchMind — Implementation Plan for Phase 1 + 2 Features

**To:** Alp
**From:** Kemal (via Claude)
**Date:** 2026-04-29

---

## TL;DR

Reading your "Next-Level Vision" doc — agreed on all 8 ideas. Decided to ship **5 of them right now** instead of waiting. Voice Mode, Memory Lane, Pre-Bet Pause, Dream Bet, and Live Match Co-Pilot are being built today in parallel using Claude Code worktrees.

Predictive Notifications is deferred (needs web push infrastructure that's a separate project). Group Chat Bot + Social Proof stay in Phase 3 as you suggested.

This document explains exactly **what each feature does**, **how it's being built**, and **what's left for you to review** when they ship.

---

## What's already in the stack (helps these features)

- ✅ OpenAI SDK installed (GPT-4o, GPT-4o-mini, Embeddings, TTS)
- ✅ Supabase + Postgres (we just need to enable pgvector for Memory Lane)
- ✅ API-Football Pro plan (450/min, has live data feed)
- ✅ The AI Coach API exists at `/api/coach-with-data`
- ✅ Bankroll system with Kelly Criterion already implemented (`lib/bankroll.ts`)
- ✅ Prediction records, value bets, EV calculation all live
- ✅ Dark theme design system established (#0A0F1E, blue accents, rounded-2xl)

---

## Feature 1: Voice Mode 🎙️

**Status:** ✅ BUILT (in worktree, ready to merge)

**The pitch (your words):** *"Hey, anything I should know about today?" → AI responds out loud.*

### How it works
- **Voice input:** Browser-native Web Speech API (no cost, no API call). User taps mic button on the AI Coach page, speaks, transcript fills the input.
- **Voice output:** OpenAI TTS (`tts-1`, voice "onyx") — new endpoint `/api/voice-tts` streams MP3 audio.
- **UI:** Mic button (pulsing red when recording), "Voice mode" toggle in header, speaker button under each AI message.
- **Browser handling:** Web Speech API only works in Chrome/Edge — graceful banner shown otherwise.

### What it touches
- New: `app/api/voice-tts/route.ts`
- Modified: `components/coach/CoachPageWithData.tsx`

### Cost
- Voice input: free (browser does it)
- TTS output: ~$0.015 per 1k characters. Capped at 1000 chars per response → ~£0.012 per AI message read aloud
- At 100 daily active users with 5 voice messages each: ~£6/day (£180/mo). Worth it for the wow factor.

---

## Feature 2: Memory Lane 🧠

**Status:** 🔧 Building now (parallel agent)

**The pitch (your words):** *"Bro, this app remembered something I said 3 months ago." That's the viral tweet.*

### How it works
- Every user ↔ AI message gets embedded via OpenAI `text-embedding-3-small` ($0.00002 per 1k tokens — basically free)
- Stored in Supabase `user_memories` table with `pgvector` for similarity search
- Before every AI response: retrieve top 5 most relevant past memories for that user
- Inject into the system prompt as context: *"What you remember about this user: [...]"*

### What it touches
- New SQL migration: `supabase/memory-lane.sql` (creates table + RPC for vector search)
- New library: `lib/memory-lane.ts` (embed, save, retrieve helpers)
- Modified: `app/api/coach-with-data/route.ts` (inject memories into prompt, save after response)
- New page: `app/dashboard/memories` — lets users see what the AI remembers, search by semantic similarity, delete individual memories ("forget this")
- New nav link: "Memories"

### The hard part you'll review
The system prompt injection. We don't want the AI to robotically recite memories — it should weave them in naturally only when relevant. The retrieval threshold (cosine similarity >0.78) and limit (top 5) might need tuning once we have real conversations.

### Privacy note
The "forget this" button matters. GDPR + builds trust. Already in the spec.

---

## Feature 3: Pre-Bet Pause ⏸️

**Status:** 🔧 Building now (parallel agent)

**The pitch (your words):** *"This is our ethical moat. When regulators eventually crack down on gambling apps, we're the platform that already cared."*

### How it works
- Wraps the "Place Bet" CTA on the predictions page
- Click → modal pops up with:
  - Bet details (match, market, odds)
  - **AI risk rating:** ✅ Looks good / ⚠️ Caution / 🛑 High Risk
  - 2-3 bullet points of AI reasoning
  - Two buttons: "Place Bet" (proceeds to Bet365) / "Cancel" (closes)
- Risk signals checked: stake vs user's average, recent losing streak, betting frequency in last hour, market type (longshot vs core)
- AI call: GPT-4o-mini (cheap, fast — ~£0.0001 per check)

### What it touches
- New: `components/pre-bet-pause.tsx`
- New: `app/api/pre-bet-check/route.ts`
- Modified: `app/dashboard/predictions/page.tsx` (intercept the Place Bet click)

### Why GPT-4o-mini and not just rules
Pure rules can't catch nuance. "User stake is 5x higher than average" is a flag — but if it's because they specifically said "I want to risk more on UCL nights" in past conversations (which Memory Lane provides), the AI can soften the warning. Rules + AI > rules alone.

---

## Feature 4: The Dream Bet 🎯

**Status:** 🔧 Building now (parallel agent)

**The pitch (your words):** *"We're not just an analytics tool — we're a financial advisor for your betting bankroll. People will share their progress on social media."*

### How it works
- New page `/dashboard/dream-bet`
- User sets: starting bankroll, target, end date, risk level (conservative/balanced/aggressive)
- Daily plan generated: today's recommended stake (Kelly-sized), which value bets qualify for this risk level, what to skip
- Progress bar comparing actual bankroll to "on-pace" trajectory
- AI motivational message updated daily based on whether you're ahead/behind

### What it touches
- New: `app/dashboard/dream-bet/page.tsx`
- New: `app/api/dream-bet/route.ts` (GET = current goal+plan, POST = create/update)
- New SQL migration: `supabase/dream-bet.sql` (creates `dream_bet_goals` table with RLS)
- New nav link: "Dream Bet"

### Stake sizing math
Standard Kelly: `stake = (edge × bankroll) / odds`

Adjusted by risk level:
- Conservative = 0.25 × Kelly (quarter-Kelly, the academic recommendation)
- Balanced = 0.5 × Kelly (half-Kelly)
- Aggressive = 1.0 × Kelly (full Kelly — high variance)

If user is behind target, plan stays the same (no chasing — that's the whole point of being honest about the math).

### The honest moment
If it's mathematically impossible to hit the target without going to >1.5x Kelly, the AI says so directly: *"We're £40 behind target. Hitting £500 from here in 3 weeks requires riskier bets than I'd recommend. Want to extend the timeline or change the goal?"* — exactly your spec.

---

## Feature 5: Live Match Co-Pilot 📺

**Status:** 🔧 Building now (parallel agent)

**The pitch (your words):** *"Every other betting app shows raw live stats. We give you a friend who watches with you."*

### How it works
- New page `/dashboard/live` shows all live matches today
- Click "Watch with AI" → side panel slides in (drawer on desktop, bottom sheet on mobile)
- Polls `/api/live-copilot?fixtureId=X` every 60 seconds
- API:
  1. Fetches live state from API-Football (`/fixtures?live=all`)
  2. Compares to last seen state (in-memory cache for MVP)
  3. If something material changed (goal, red card, big xG shift, odds movement) → asks GPT-4o "is there anything worth saying?"
  4. GPT-4o returns commentary OR stays silent
- Commentary log: newest at top, scrollable history

### What it touches
- New: `app/api/live-copilot/route.ts`
- New: `components/live-copilot.tsx`
- New: `app/dashboard/live/page.tsx`
- New nav link: "Live Matches"

### The "stay quiet" rule
This is the hardest part to get right. Most apps would notify constantly. The whole point here is that 90% of the time the AI says nothing. When it speaks, it's because something genuinely shifted. We'll tune the change-detection thresholds based on real match data.

### Cost
- API-Football: live calls included in Pro plan
- GPT-4o: ~£0.005 per commentary call. If it speaks 5x per match for 1 user watching 1 match → £0.025/match. 100 users × 2 matches/week = £20/week (£80/mo)
- Worth it. This is the feature that gets shared in WhatsApp groups.

---

## What's deferred and why

### Predictive Notifications 🔔
- **Why deferred:** Needs web push infrastructure (service worker, web-push library, VAPID keys, user permission flow). It's a 3-5 day project on its own and doesn't have a meaningful MVP without push actually working. Current stack is email-first via Resend.
- **When:** After web push infrastructure is built (Q2). Will piggyback on whatever push system we add.

### Group Chat Bot 💬 (Phase 3)
- **Why deferred:** WhatsApp Business API requires a Meta business verification process that takes weeks. Telegram is faster but has lower distribution.
- **When:** Q4 2026 as you suggested. Worth doing right rather than rushing.

### Social Proof 👥 (Phase 3)
- **Why deferred:** Honest reason — we have 8 users right now (F&F). Clusters need scale. Useful when we hit ~500 active users.
- **When:** Once user count justifies the math (post-launch, post-marketing push).

---

## Timeline (tonight)

| Feature | Status | ETA |
|---------|--------|-----|
| Voice Mode | ✅ Built | Done |
| Pre-Bet Pause | 🔧 Building | ~30 min |
| Dream Bet | 🔧 Building | ~45 min |
| Memory Lane | 🔧 Building | ~45 min |
| Live Co-Pilot | 🔧 Building | ~60 min |

All five are being built in parallel as isolated git worktrees so they can be reviewed and merged independently.

---

## Tomorrow

1. Review each PR (one per feature)
2. Apply the two new Supabase migrations (Memory Lane + Dream Bet)
3. Test on staging
4. Ship to production
5. Post about Voice Mode on Twitter — that's the launch demo. Record a 30-second video of you asking "any value bets tonight?" and the AI responding out loud. Done.

---

## What I want from you (Alp)

1. **Voice persona** — should the AI sound like a calm analyst (current "onyx" voice) or something punchier? Test the demo and tell me.
2. **Pre-Bet Pause copy** — review the modal text. The line between helpful and patronising matters here.
3. **Dream Bet risk levels** — agree with the Kelly fractions (0.25 / 0.5 / 1.0)? The aggressive option will lose users their bankroll fast. Is that on us or on them?
4. **Live Co-Pilot voice** — should it just be text or should it ALSO speak (using the Voice Mode TTS)? Could be incredible during a match. Could also be too much.

Hit me back with your reactions. Ship 1 of these on Monday, the rest by end of week.

— Kemal
