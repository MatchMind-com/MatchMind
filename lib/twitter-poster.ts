/**
 * Shared Twitter v2 OAuth 1.0a poster used by all admin endpoints that
 * post to @Match_Mind_AI. Extracted from the 3 duplicates inside
 * /api/admin/post-tonight-acca, post-kickoff-alerts, post-tweets.
 *
 * Required env vars (set in Vercel):
 *   TWITTER_API_KEY
 *   TWITTER_API_SECRET
 *   TWITTER_ACCESS_TOKEN
 *   TWITTER_ACCESS_SECRET
 */
import crypto from 'crypto'

const TWITTER_URL = 'https://api.twitter.com/2/tweets'
const ACCOUNT_HANDLE = 'Match_Mind_AI'

export interface PostTweetResult {
  ok: boolean
  id?: string
  url?: string
  error?: string
}

export async function postTweet(text: string): Promise<PostTweetResult> {
  const apiKey = process.env.TWITTER_API_KEY
  const apiSecret = process.env.TWITTER_API_SECRET
  const accessToken = process.env.TWITTER_ACCESS_TOKEN
  const accessSecret = process.env.TWITTER_ACCESS_SECRET
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    return { ok: false, error: 'Twitter credentials not configured' }
  }

  const nonce = crypto.randomBytes(16).toString('hex')
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  }
  const sortedParams = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&')
  const sigBase = `POST&${encodeURIComponent(TWITTER_URL)}&${encodeURIComponent(sortedParams)}`
  const sigKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`
  const signature = crypto.createHmac('sha1', sigKey).update(sigBase).digest('base64')
  oauthParams.oauth_signature = signature
  const authHeader =
    'OAuth ' +
    Object.keys(oauthParams)
      .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
      .join(', ')

  try {
    const res = await fetch(TWITTER_URL, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(data)}` }
    const id = data.data?.id as string | undefined
    return {
      ok: true,
      id,
      url: id ? `https://x.com/${ACCOUNT_HANDLE}/status/${id}` : undefined,
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'fetch failed' }
  }
}
