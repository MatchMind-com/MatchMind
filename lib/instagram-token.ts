/**
 * lib/instagram-token.ts
 *
 * Storage + refresh helpers for the Instagram long-lived access token
 * (60-day TTL). Backed by Supabase `app_secrets` table for rotation; falls
 * back to the static `INSTAGRAM_ACCESS_TOKEN` env var if no DB row exists
 * (first-run / migration not applied).
 *
 * Used by:
 *   - /api/admin/post-instagram         → reads token before publishing
 *   - /api/admin/refresh-instagram-token → writes new token after refresh
 *
 * Refresh strategy: a GHA cron hits the refresh endpoint twice per month.
 * Each refresh extends the token to 60 days from refresh time, so the
 * pipeline never expires as long as the cron runs at least every ~50 days.
 */
import { createClient as createAdmin } from '@supabase/supabase-js'

const KEY_INSTAGRAM_TOKEN = 'INSTAGRAM_ACCESS_TOKEN'
const REFRESH_BASE = 'https://graph.instagram.com/refresh_access_token'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdmin(url, key, { auth: { persistSession: false } })
}

/**
 * Returns the current Instagram access token. Prefers the rotating value
 * in Supabase; falls back to the env var when the DB row hasn't been
 * seeded yet (e.g. before the first refresh cron run).
 */
export async function getInstagramToken(): Promise<{ token: string | null; source: 'db' | 'env' | 'none'; expiresAt: string | null }> {
  const sb = admin()
  if (sb) {
    try {
      const { data, error } = await sb
        .from('app_secrets')
        .select('value, expires_at')
        .eq('key', KEY_INSTAGRAM_TOKEN)
        .maybeSingle()
      if (!error && data?.value) {
        return { token: data.value as string, source: 'db', expiresAt: (data.expires_at as string) ?? null }
      }
    } catch {
      // fall through to env fallback
    }
  }
  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN ?? null
  return { token: envToken, source: envToken ? 'env' : 'none', expiresAt: null }
}

/**
 * Persists a refreshed token. Upserts into app_secrets so subsequent calls
 * to getInstagramToken() pick it up immediately (no Vercel redeploy needed
 * because we're reading from the DB, not env).
 */
export async function saveInstagramToken(token: string, expiresInSec: number): Promise<{ ok: boolean; error?: string }> {
  const sb = admin()
  if (!sb) return { ok: false, error: 'Supabase service-role key not configured' }
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString()
  try {
    const { error } = await sb
      .from('app_secrets')
      .upsert(
        { key: KEY_INSTAGRAM_TOKEN, value: token, updated_at: new Date().toISOString(), expires_at: expiresAt },
        { onConflict: 'key' },
      )
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'unknown DB error' }
  }
}

/**
 * Calls IG /refresh_access_token to extend the current long-lived token to
 * a fresh 60-day window. Returns the new token + expiry. Caller is
 * responsible for persisting via saveInstagramToken().
 */
export async function refreshInstagramToken(currentToken: string): Promise<
  | { ok: true; token: string; expiresIn: number; permissions?: string }
  | { ok: false; error: string; status?: number }
> {
  const url = `${REFRESH_BASE}?grant_type=ig_refresh_token&access_token=${encodeURIComponent(currentToken)}`
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-store' })
  } catch (e: any) {
    return { ok: false, error: `network: ${e?.message ?? 'unknown'}` }
  }
  const data: any = await res.json().catch(() => null)
  if (!res.ok || !data?.access_token) {
    return { ok: false, error: JSON.stringify(data ?? { raw: 'no body' }), status: res.status }
  }
  return {
    ok: true,
    token: data.access_token as string,
    expiresIn: Number(data.expires_in ?? 0),
    permissions: data.permissions as string | undefined,
  }
}
