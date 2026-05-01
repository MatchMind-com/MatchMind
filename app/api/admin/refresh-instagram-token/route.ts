/**
 * POST /api/admin/refresh-instagram-token
 *
 * Refreshes the Instagram long-lived token via the IG Business Login
 * /refresh_access_token endpoint, then persists the new token to Supabase
 * (`app_secrets` table). Subsequent /api/admin/post-instagram calls read
 * the new token automatically — no Vercel redeploy required.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 *
 * Designed to be called by .github/workflows/instagram-token-refresh.yml on
 * the 1st and 15th of each month. IG long-lived tokens expire 60 days from
 * issue; each refresh resets the clock to 60 days from refresh time, so
 * twice/month gives 30+ days of safety buffer.
 *
 * Body (optional): {} — no inputs.
 *
 * Returns:
 *   {
 *     success: true,
 *     source: 'db' | 'env',           // where the OLD token came from
 *     expires_in_seconds: 5184000,    // ~60 days
 *     expires_at: '2026-06-30T...',
 *     permissions: 'instagram_business_basic,...'
 *   }
 *
 * Errors:
 *   - 401 if CRON_SECRET mismatch
 *   - 500 if no current token found anywhere
 *   - 502 if IG refresh API fails (e.g. token revoked/expired beyond
 *     refresh window). In that case the user must re-run the OAuth flow
 *     manually to mint a fresh token.
 */
import { NextResponse } from 'next/server'
import { getInstagramToken, refreshInstagramToken, saveInstagramToken } from '@/lib/instagram-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const current = await getInstagramToken()
  if (!current.token) {
    return NextResponse.json(
      {
        error:
          'No Instagram token found in either Supabase app_secrets or env (INSTAGRAM_ACCESS_TOKEN). Re-run the OAuth flow to mint a new one.',
      },
      { status: 500 },
    )
  }

  const refreshed = await refreshInstagramToken(current.token)
  if (!refreshed.ok) {
    return NextResponse.json(
      {
        error: `IG refresh failed (HTTP ${refreshed.status ?? '?'}): ${refreshed.error}`,
        hint:
          'If error is "Invalid OAuth Token", the token expired beyond the refresh window — re-run the @match.mindai OAuth flow on the Meta dev portal.',
      },
      { status: 502 },
    )
  }

  const saved = await saveInstagramToken(refreshed.token, refreshed.expiresIn)
  if (!saved.ok) {
    // Token refreshed successfully but DB write failed. Return new token
    // verbatim so a human operator can manually patch it into Vercel env
    // as a fallback. We don't normally surface tokens but this is an
    // admin-only endpoint behind CRON_SECRET.
    return NextResponse.json(
      {
        success: false,
        refreshed: true,
        persisted: false,
        error: `DB write failed: ${saved.error}`,
        new_token: refreshed.token,
        expires_in_seconds: refreshed.expiresIn,
        hint:
          'Token was refreshed at IG but Supabase upsert failed. Paste new_token into Vercel env INSTAGRAM_ACCESS_TOKEN and redeploy to keep posting working.',
      },
      { status: 500 },
    )
  }

  const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
  return NextResponse.json({
    success: true,
    source: current.source,
    expires_in_seconds: refreshed.expiresIn,
    expires_at: expiresAt,
    permissions: refreshed.permissions ?? null,
  })
}
