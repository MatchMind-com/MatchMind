import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { kellyStake } from '@/lib/bankroll'

export const dynamic = 'force-dynamic'

type RiskLevel = 'conservative' | 'balanced' | 'aggressive'

interface Goal {
  id: string
  user_id: string
  starting_bankroll: number
  current_bankroll: number
  target: number
  end_date: string
  risk_level: RiskLevel
  created_at: string
  updated_at: string
}

interface DailyPlan {
  daysRemaining: number
  requiredDailyGrowthPct: number
  recommendedStake: number
  kellyFraction: number
  qualifyingBetsHint: string
  onTrack: boolean
  progressPct: number
  motivational: string
}

const RISK_FRACTION: Record<RiskLevel, number> = {
  conservative: 0.25, // quarter-Kelly
  balanced: 0.5,      // half-Kelly
  aggressive: 0.75,   // three-quarter Kelly
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

async function buildMotivational(goal: Goal, plan: Omit<DailyPlan, 'motivational'>): Promise<string> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const prompt = `You are a friendly betting coach. The user's goal:
- Starting bankroll: £${goal.starting_bankroll}
- Current: £${goal.current_bankroll}
- Target: £${goal.target} by ${goal.end_date}
- Risk: ${goal.risk_level}
- Days left: ${plan.daysRemaining}
- Progress: ${plan.progressPct}%
- On track: ${plan.onTrack ? 'yes' : 'no'}

Reply with ONE short motivational sentence (max 22 words). Honest, not hype. No emojis.`
    const c = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 60,
      temperature: 0.7,
    })
    return c.choices[0]?.message?.content?.trim() || defaultMessage(plan)
  } catch {
    return defaultMessage(plan)
  }
}

function defaultMessage(plan: Omit<DailyPlan, 'motivational'>): string {
  if (plan.progressPct >= 100) return 'Goal reached. Lock it in or set a new target.'
  if (plan.onTrack) return 'You are on pace. Stick to the plan and trust the math.'
  return 'Behind pace, but discipline beats heroics. One good +EV bet at a time.'
}

function computePlan(goal: Goal): Omit<DailyPlan, 'motivational'> {
  const today = new Date()
  const end = new Date(goal.end_date)
  const days = daysBetween(today, end)
  const remainingMultiple = goal.current_bankroll > 0 ? goal.target / goal.current_bankroll : 0
  // Required daily growth to hit target compounding
  const requiredDailyGrowthPct =
    days > 0 && remainingMultiple > 0
      ? (Math.pow(remainingMultiple, 1 / days) - 1) * 100
      : 0
  const fraction = RISK_FRACTION[goal.risk_level] ?? 0.5
  // Assume average +EV bet has ~6% edge at odds ~2.0 — typical for our predictions
  const recommendedStake = kellyStake(goal.current_bankroll, 6, 2.0, fraction)
  const progressPct =
    goal.target > goal.starting_bankroll
      ? Math.max(0, Math.min(100, ((goal.current_bankroll - goal.starting_bankroll) / (goal.target - goal.starting_bankroll)) * 100))
      : 0
  // On track = current bankroll >= linearly-interpolated expected
  const totalDays = Math.max(1, daysBetween(new Date(goal.created_at), end))
  const elapsed = Math.max(0, totalDays - days)
  const expectedBankroll =
    goal.starting_bankroll + ((goal.target - goal.starting_bankroll) * elapsed) / totalDays
  const onTrack = goal.current_bankroll >= expectedBankroll

  const qualifyingBetsHint =
    goal.risk_level === 'conservative'
      ? 'Easy tier (odds 1.40–1.80, +EV) on the Predictions page'
      : goal.risk_level === 'aggressive'
      ? 'Hard tier (odds 2.50–4.00, +EV) on the Predictions page'
      : 'Medium tier (odds 1.80–2.50, +EV) on the Predictions page'

  return {
    daysRemaining: days,
    requiredDailyGrowthPct: Math.round(requiredDailyGrowthPct * 100) / 100,
    recommendedStake,
    kellyFraction: fraction,
    qualifyingBetsHint,
    onTrack,
    progressPct: Math.round(progressPct * 10) / 10,
  }
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('dream_bet_goals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[dream-bet GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) return NextResponse.json({ goal: null, plan: null })

  const goal = data as Goal
  const planCore = computePlan(goal)
  const motivational = await buildMotivational(goal, planCore)
  const plan: DailyPlan = { ...planCore, motivational }
  return NextResponse.json({ goal, plan })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    starting_bankroll,
    current_bankroll,
    target,
    end_date,
    risk_level,
  } = body as Partial<Goal>

  if (
    starting_bankroll == null ||
    target == null ||
    !end_date
  ) {
    return NextResponse.json({ error: 'starting_bankroll, target, end_date required' }, { status: 400 })
  }

  if (Number(target) <= Number(starting_bankroll)) {
    return NextResponse.json({ error: 'target must be greater than starting_bankroll' }, { status: 400 })
  }

  // Upsert: if a goal already exists for this user, update it; else insert.
  const { data: existing } = await supabase
    .from('dream_bet_goals')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const payload = {
    user_id: user.id,
    starting_bankroll: Number(starting_bankroll),
    current_bankroll: Number(current_bankroll ?? starting_bankroll),
    target: Number(target),
    end_date,
    risk_level: (risk_level as RiskLevel) ?? 'balanced',
    updated_at: new Date().toISOString(),
  }

  let saved: Goal | null = null
  if (existing?.id) {
    const { data, error } = await supabase
      .from('dream_bet_goals')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) {
      console.error('[dream-bet POST update]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    saved = data as Goal
  } else {
    const { data, error } = await supabase
      .from('dream_bet_goals')
      .insert(payload)
      .select('*')
      .single()
    if (error) {
      console.error('[dream-bet POST insert]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    saved = data as Goal
  }

  if (!saved) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  const planCore = computePlan(saved)
  const motivational = await buildMotivational(saved, planCore)
  return NextResponse.json({ goal: saved, plan: { ...planCore, motivational } })
}
