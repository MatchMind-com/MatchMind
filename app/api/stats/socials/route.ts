import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Public endpoint surfacing live(-ish) social account stats for the
// Command Center HTML at /Users/admin/Desktop/🚀 MatchMind Command Center.html.
//
// Twitter: live via OAuth 1.0a (we already have read+write creds for posting)
// TikTok:  hardcoded until Kemal sets up the dev app (no public stats endpoint
//          without OAuth — see project_social_automation_status.md)
// Instagram: hardcoded until FB account appeal resolves and Graph API is wired

export const revalidate = 600 // 10 min — Twitter rate-limits hard

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const TWITTER_USERNAME = 'Match_Mind_AI'

// Manually-tracked counts. Update when checking the apps.
const TIKTOK_FALLBACK = { followers: 5534, posts: 6, handle: '@match.mindai' }
const INSTAGRAM_FALLBACK = { followers: 2, posts: 1, handle: '@match.mindai' }

function oauthSignedHeader(method: string, url: string): string | null {
  const apiKey = process.env.TWITTER_API_KEY
  const apiSecret = process.env.TWITTER_API_SECRET
  const accessToken = process.env.TWITTER_ACCESS_TOKEN
  const accessSecret = process.env.TWITTER_ACCESS_SECRET
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) return null

  const u = new URL(url)
  const baseUrl = `${u.protocol}//${u.host}${u.pathname}`
  const queryParams: Record<string, string> = {}
  u.searchParams.forEach((v, k) => { queryParams[k] = v })

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  }
  const allParams = { ...queryParams, ...oauthParams }
  const sortedParams = Object.keys(allParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&')
  const sigBase = `${method}&${encodeURIComponent(baseUrl)}&${encodeURIComponent(sortedParams)}`
  const sigKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`
  const signature = crypto.createHmac('sha1', sigKey).update(sigBase).digest('base64')
  oauthParams.oauth_signature = signature
  return 'OAuth ' + Object.keys(oauthParams)
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')
}

async function fetchTwitterStats() {
  // Twitter API v2 free tier allows /users/by/username/:username with public_metrics
  const url = `https://api.twitter.com/2/users/by/username/${TWITTER_USERNAME}?user.fields=public_metrics,description,verified`
  const auth = oauthSignedHeader('GET', url)
  if (!auth) return { error: 'twitter_credentials_missing' }
  try {
    const res = await fetch(url, { headers: { Authorization: auth }, next: { revalidate: 600 } })
    if (!res.ok) {
      const body = await res.text()
      return { error: `twitter_http_${res.status}`, detail: body.slice(0, 200) }
    }
    const data = await res.json()
    const m = data?.data?.public_metrics
    return {
      handle: `@${TWITTER_USERNAME}`,
      followers: m?.followers_count ?? null,
      following: m?.following_count ?? null,
      tweet_count: m?.tweet_count ?? null,
      listed: m?.listed_count ?? null,
      verified: data?.data?.verified ?? false,
      user_id: data?.data?.id ?? null,
    }
  } catch (e: any) {
    return { error: 'twitter_exception', detail: e.message }
  }
}

async function fetchTwitterRecentEngagement(userId: string | null) {
  // Latest 5 tweets with public_metrics — free tier allows /2/users/:id/tweets
  if (!userId) return null
  const url = `https://api.twitter.com/2/users/${userId}/tweets?max_results=5&tweet.fields=public_metrics,created_at`
  const auth = oauthSignedHeader('GET', url)
  if (!auth) return null
  try {
    const res = await fetch(url, { headers: { Authorization: auth }, next: { revalidate: 600 } })
    if (!res.ok) return null
    const data = await res.json()
    const tweets = (data?.data || []).map((t: any) => ({
      id: t.id,
      text: (t.text || '').slice(0, 120),
      created_at: t.created_at,
      likes: t.public_metrics?.like_count ?? 0,
      retweets: t.public_metrics?.retweet_count ?? 0,
      replies: t.public_metrics?.reply_count ?? 0,
      impressions: t.public_metrics?.impression_count ?? null,
    }))
    const totals = tweets.reduce((acc: any, t: any) => ({
      likes: acc.likes + t.likes,
      retweets: acc.retweets + t.retweets,
      replies: acc.replies + t.replies,
      impressions: (acc.impressions ?? 0) + (t.impressions ?? 0),
    }), { likes: 0, retweets: 0, replies: 0, impressions: 0 })
    return { recent: tweets, totals_last_5: totals }
  } catch {
    return null
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET() {
  const twitter = await fetchTwitterStats()
  const engagement = 'user_id' in twitter && twitter.user_id
    ? await fetchTwitterRecentEngagement(twitter.user_id)
    : null

  return NextResponse.json({
    twitter: { ...twitter, ...(engagement || {}) },
    tiktok: {
      ...TIKTOK_FALLBACK,
      live: false,
      reason: 'TikTok dev app not yet created — see project_social_automation_status.md',
    },
    instagram: {
      ...INSTAGRAM_FALLBACK,
      live: false,
      reason: 'IG Graph API blocked on FB account appeal — see project_social_automation_status.md',
    },
    fetched_at: new Date().toISOString(),
  }, { headers: CORS_HEADERS })
}
