/**
 * GET /api/admin/tiktok-oauth/callback
 *
 * TikTok OAuth redirect target. Once @MatchMind_AI authorises the app,
 * TikTok redirects here with `?code=…&state=…`. We exchange the code
 * for an access token + refresh token, then display them so we can
 * paste them into Vercel env (TIKTOK_ACCESS_TOKEN / TIKTOK_REFRESH_TOKEN).
 *
 * Auth: query param `?secret=${CRON_SECRET}` so randoms hitting the URL
 * can't trigger a token exchange. The browser must include it on the
 * initial OAuth flow start (we'll bake it into the authorize URL).
 *
 * Env required:
 *   TIKTOK_CLIENT_KEY     from your TikTok dev app
 *   TIKTOK_CLIENT_SECRET  from your TikTok dev app
 *
 * After the access_token lands in your Vercel env, the actual posting
 * endpoint /api/admin/post-tiktok will start working. Refresh tokens
 * are valid 365 days; access tokens expire in 24h — schedule a refresh
 * cron (out of scope for this iteration).
 */

import { NextRequest, NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.matchmindcom.com'
const REDIRECT_URI = `${APP_URL}/api/admin/tiktok-oauth/callback`

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const secret = searchParams.get('secret')
  const error = searchParams.get('error')
  const errDesc = searchParams.get('error_description')

  // The CRON_SECRET is passed back as the `state` param by the authorize
  // URL — TikTok mirrors it verbatim. We treat it as the auth token here.
  if (state !== process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return new NextResponse('Unauthorized — state / secret mismatch.', { status: 401 })
  }

  if (error) {
    return new NextResponse(
      `TikTok OAuth error: ${error}\n\nDescription: ${errDesc ?? 'none'}`,
      { status: 400, headers: { 'content-type': 'text/plain' } },
    )
  }

  if (!code) {
    // Initial step — no `code` yet. Render an HTML page that explains
    // how to start the flow (link to authorize URL).
    const clientKey = process.env.TIKTOK_CLIENT_KEY ?? '<TIKTOK_CLIENT_KEY missing>'
    const cronSecret = process.env.CRON_SECRET ?? ''
    const authUrl = `https://www.tiktok.com/v2/auth/authorize/` +
      `?client_key=${encodeURIComponent(clientKey)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('user.info.basic,video.publish,video.upload')}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&state=${encodeURIComponent(cronSecret)}`
    return new NextResponse(
      `<!doctype html><html><body style="font-family:system-ui;max-width:560px;margin:60px auto;padding:0 20px;background:#0F1115;color:#F5F1E8">
<h1 style="color:#F97316">TikTok OAuth — start</h1>
<p>To authorise MatchMind to post on @MatchMind_AI:</p>
<ol>
<li>Make sure you're logged into <a style="color:#F97316" href="https://www.tiktok.com" target="_blank">tiktok.com</a> as @MatchMind_AI in this browser.</li>
<li>Click the button below to authorise.</li>
<li>You'll be redirected back here with the access &amp; refresh tokens.</li>
</ol>
<p><a href="${authUrl}" style="display:inline-block;background:#F97316;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Authorise on TikTok →</a></p>
<p style="color:#9CA3AF;font-size:13px;margin-top:30px">If TIKTOK_CLIENT_KEY isn't set yet, this page will still render but the link will be broken.</p>
</body></html>`,
      { status: 200, headers: { 'content-type': 'text/html' } },
    )
  }

  // We have a code — exchange it for an access token.
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  if (!clientKey || !clientSecret) {
    return new NextResponse(
      'TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET not set in Vercel env.',
      { status: 500 },
    )
  }

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
  })
  let tokenJson: any = null
  try {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    tokenJson = await res.json().catch(() => null)
    if (!res.ok) {
      return new NextResponse(
        `TikTok token exchange failed (HTTP ${res.status}):\n\n${JSON.stringify(tokenJson, null, 2)}`,
        { status: 502, headers: { 'content-type': 'text/plain' } },
      )
    }
  } catch (e: any) {
    return new NextResponse(`Token exchange threw: ${e?.message}`, { status: 502 })
  }

  // Render the tokens. User copies them into Vercel env then the post-
  // tiktok endpoint will work.
  const accessToken = tokenJson?.access_token
  const refreshToken = tokenJson?.refresh_token
  const expiresIn = tokenJson?.expires_in
  const refreshExpiresIn = tokenJson?.refresh_expires_in
  const openId = tokenJson?.open_id
  const scopes = tokenJson?.scope

  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;max-width:680px;margin:60px auto;padding:0 20px;background:#0F1115;color:#F5F1E8">
<h1 style="color:#22C55E">✓ TikTok OAuth complete</h1>
<p>Add these to your Vercel project env vars (Production scope):</p>
<pre style="background:#1A1D24;border:1px solid #2A2F38;padding:16px;border-radius:8px;overflow:auto">TIKTOK_ACCESS_TOKEN=${accessToken ?? '(missing)'}
TIKTOK_REFRESH_TOKEN=${refreshToken ?? '(missing)'}
TIKTOK_OPEN_ID=${openId ?? '(missing)'}</pre>
<p style="color:#9CA3AF;font-size:13px">
Access token expires in <strong>${expiresIn ?? '?'}s</strong> (~24h). Refresh token expires in <strong>${refreshExpiresIn ?? '?'}s</strong> (~365d).<br>
Granted scopes: <strong>${scopes ?? '?'}</strong>
</p>
<p style="color:#9CA3AF;font-size:13px">After redeploying with these env vars, /api/admin/post-tiktok will work.</p>
</body></html>`,
    { status: 200, headers: { 'content-type': 'text/html', 'cache-control': 'no-store' } },
  )
}
