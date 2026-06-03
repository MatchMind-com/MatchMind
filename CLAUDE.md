# MatchMind — Project Context

## What it is
AI-powered football betting analytics platform. Helps bettors find value bets by comparing AI probability against bookmaker odds (Pinnacle edge detection). Not a betting site — it's analytics software.

## Stack
- Next.js 14 (App Router)
- Supabase (auth + database)
- Tailwind CSS
- OpenAI GPT-4o
- Stripe (billing)
- Sentry (error tracking)
- Vercel (hosting)

## Brand
- Name: MatchMind
- Domain: matchmindcom.com
- Tone: direct, data-led, anti-hype. Never claim guaranteed wins.
- Colors: dark bg `#0B0B14`, orange accent `#F97316` / `orange-500`, card bg `#13131F`
- Social: TikTok @match.mindai, Instagram @match.mindai, Twitter @Match_Mind_AI

## Key features
- AI value bet predictions (GPT-4o, 25 leagues)
- Pinnacle edge detection (positive EV picks)
- Bet slip tracker + auto-verification
- Bankroll manager + Kelly staking
- AI betting coach (chat)
- Public track record (full transparency)

## Pricing
- Free: 3 picks/day, bet tracker, public track record
- Pro: £9.99/month — unlimited picks, all features, cancel anytime

## Target audience
UK-based sports bettors, value betting enthusiasts. 18+. Legal in UK (analytics software, not a bookmaker).

## Key pages
- `/` — landing page (app/page.tsx)
- `/dashboard` — main app
- `/predictions` — all picks
- `/value-bets` — value bets feed
- `/track-record` — public results
- `/world-cup` — 2026 World Cup hub
- `/signup`, `/login`

## Design goals
- Should NOT look like a generic SaaS template
- Needs to feel like a sports product — raw, confident, match-day energy
- Avoid: generic blur glows, standard hero layouts, ChatGPT-style card designs
- Aim for: bold typography, real data front and center, editorial feel

## Compliance
Always include 18+ disclaimer and BeGambleAware.org link on public pages. Never guarantee wins.
