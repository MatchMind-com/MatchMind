/**
 * In-memory sliding-window rate limit.
 *
 * Scoped per serverless instance — not a cross-region global limit. Fine as a
 * first defence against single-source abuse; upgrade to Upstash/Redis when
 * traffic grows enough that one hot region matters.
 */

type Entry = { timestamps: number[] }
const buckets = new Map<string, Entry>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetMs: number } {
  const now = Date.now()
  const cutoff = now - windowMs
  const entry = buckets.get(key) ?? { timestamps: [] }

  entry.timestamps = entry.timestamps.filter(t => t > cutoff)

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0]
    buckets.set(key, entry)
    return { ok: false, remaining: 0, resetMs: oldest + windowMs - now }
  }

  entry.timestamps.push(now)
  buckets.set(key, entry)

  // Opportunistic cleanup to keep the map bounded
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.timestamps.length === 0 || v.timestamps[v.timestamps.length - 1] < cutoff) buckets.delete(k)
    }
  }

  return { ok: true, remaining: limit - entry.timestamps.length, resetMs: windowMs }
}

export function getClientKey(req: Request): string {
  // Prefer Vercel's forwarded IP, fall back to remote-addr header, then "unknown"
  const xff = req.headers.get('x-forwarded-for') ?? ''
  const ip = xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  return ip
}

export function rateLimitResponse(resetMs: number): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests — please slow down' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(resetMs / 1000)),
      },
    }
  )
}
