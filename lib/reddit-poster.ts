/**
 * lib/reddit-poster.ts
 *
 * Reddit OAuth + submit helpers for the daily acca poster.
 *
 * Reddit uses a "script app" model for personal/single-user automation:
 *   - You register an app at https://www.reddit.com/prefs/apps (type: script)
 *     → gives you client_id + client_secret
 *   - You authenticate with username + password + app creds via the password
 *     grant flow → returns a short-lived bearer token (~1h)
 *   - Token is fetched fresh on every post — no refresh cron needed
 *     (unlike Instagram which uses 60-day rotating tokens).
 *
 * Required env vars (set in Vercel):
 *   REDDIT_CLIENT_ID       app id from /prefs/apps (under the app name)
 *   REDDIT_CLIENT_SECRET   app secret from /prefs/apps
 *   REDDIT_USERNAME        your Reddit handle (no leading u/)
 *   REDDIT_PASSWORD        your Reddit account password
 *   REDDIT_SUBREDDIT       target subreddit, no leading r/ (e.g. SoccerBetting)
 *   REDDIT_USER_AGENT      polite UA string per Reddit's rules
 *                          (e.g. "MatchMind/1.0 by /u/your_username")
 *
 * Reddit RULES — read before posting:
 *   - r/sportsbook BANS picks posts outside the daily Pick of the Day thread
 *   - r/SoccerBetting allows analysis posts with picks (recommended default)
 *   - Most subs require minimum karma + account age — if your post 404s
 *     or "removed by moderator", check the sub's automod requirements
 *   - Reddit's site-wide anti-spam will shadowban accounts that post the
 *     same content across multiple subs — keep it to ONE sub per acca
 */

const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'
const SUBMIT_URL = 'https://oauth.reddit.com/api/submit'

function userAgent(): string {
  return process.env.REDDIT_USER_AGENT || 'MatchMind/1.0'
}

/**
 * Authenticates with Reddit's password grant and returns a short-lived
 * bearer token (~1h). Each post fetches a fresh token — no caching.
 */
export async function getRedditAccessToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
  const clientId = process.env.REDDIT_CLIENT_ID
  const clientSecret = process.env.REDDIT_CLIENT_SECRET
  const username = process.env.REDDIT_USERNAME
  const password = process.env.REDDIT_PASSWORD
  if (!clientId || !clientSecret || !username || !password) {
    return { ok: false, error: 'Reddit credentials not configured (need REDDIT_CLIENT_ID/SECRET/USERNAME/PASSWORD)' }
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  let res: Response
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent(),
      },
      body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
      cache: 'no-store',
    })
  } catch (e: any) {
    return { ok: false, error: `network: ${e?.message ?? 'unknown'}` }
  }
  const data: any = await res.json().catch(() => null)
  if (!res.ok || !data?.access_token) {
    return { ok: false, error: `auth failed (HTTP ${res.status}): ${JSON.stringify(data ?? { raw: 'no body' }).slice(0, 200)}` }
  }
  return { ok: true, token: data.access_token as string }
}

/**
 * Submits a self-post (text + markdown) to a subreddit. Returns the post URL
 * on success, or an error string if Reddit rejected it (most common reasons:
 * sub-specific automod rules, account too new, suspected spam).
 */
export async function submitRedditSelfPost(
  token: string,
  subreddit: string,
  title: string,
  text: string,
): Promise<{ ok: true; url: string; permalink: string } | { ok: false; error: string }> {
  let res: Response
  try {
    res = await fetch(SUBMIT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent(),
      },
      body: new URLSearchParams({
        api_type: 'json',
        kind: 'self',
        sr: subreddit.replace(/^r\//, ''),
        title,
        text,
        nsfw: 'false',
        spoiler: 'false',
        resubmit: 'true',
        sendreplies: 'true',
      }).toString(),
      cache: 'no-store',
    })
  } catch (e: any) {
    return { ok: false, error: `network: ${e?.message ?? 'unknown'}` }
  }
  const data: any = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, error: `submit HTTP ${res.status}: ${JSON.stringify(data ?? { raw: 'no body' }).slice(0, 200)}` }
  }
  // Reddit API returns errors INSIDE a 200 response under data.json.errors
  const errors = data?.json?.errors
  if (Array.isArray(errors) && errors.length > 0) {
    return { ok: false, error: `submit rejected: ${JSON.stringify(errors).slice(0, 200)}` }
  }
  const url = data?.json?.data?.url as string | undefined
  const permalink = data?.json?.data?.permalink as string | undefined
  if (!url) {
    return { ok: false, error: `submit returned no url: ${JSON.stringify(data).slice(0, 200)}` }
  }
  return { ok: true, url, permalink: permalink ?? url }
}
