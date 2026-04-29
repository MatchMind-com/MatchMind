/**
 * /api/predictions — public cache reader
 *
 * This route ONLY reads from the predictions_cache table in Supabase.
 * The heavy work (API-Football + GPT-4o) happens in /api/cron/refresh-predictions,
 * which runs every 6 hours and writes the result to that table.
 *
 * Result: this route always returns in <200ms regardless of Vercel plan or timeout.
 * The predictions page will never 504 again.
 *
 * Cache age: returned in meta.generated_at. The cron refreshes every 6h so the
 * max staleness is 6h — acceptable for daily betting picks.
 */

import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { rateLimit, getClientKey, rateLimitResponse } from '@/lib/rate-limit'

// No expensive computation here — just a DB read.
// Short ISR so fresh cache writes appear quickly for the next visitor.
export const revalidate = 300

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  // Rate limit: 60 calls/min per IP (much more generous now that there's no OpenAI call)
  const rl = rateLimit(`predictions:${getClientKey(request)}`, 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl.resetMs)

  try {
    const { data, error } = await supabaseAdmin
      .from('predictions_cache')
      .select('payload, generated_at, fixture_count, leagues_count')
      .eq('id', 1)
      .single()

    if (error || !data) {
      // Cache miss — no predictions generated yet. Tell the client to try again later.
      return NextResponse.json(
        {
          success: false,
          error: 'Predictions are being generated. Please check back in a few minutes.',
          cache_miss: true,
        },
        { status: 503 }
      )
    }

    // Merge cache metadata into the payload's meta field
    const payload = data.payload as any
    const enriched = {
      ...payload,
      meta: {
        ...(payload.meta ?? {}),
        cache_generated_at: data.generated_at,
        fixture_count: data.fixture_count,
        leagues_count: data.leagues_count,
        served_from_cache: true,
      },
    }

    return NextResponse.json(enriched)
  } catch (err: any) {
    console.error('[predictions] DB read error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to load predictions' },
      { status: 500 }
    )
  }
}
