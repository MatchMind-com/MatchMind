import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Ad-hoc Twitter posting endpoint.
// POST { tweets: (string | { text: string, replyToId?: string })[], thread?: boolean }
// Auth: Authorization: Bearer ${CRON_SECRET}
//
// Tweet items can be a plain string OR { text, replyToId }. When replyToId is
// set, that tweet is posted as a reply to the given existing tweet ID
// (used for "✅ HIT" follow-ups on original picks).
// If thread=true, tweets without replyToId are posted as a thread (each replies to previous).
// If thread=false (default), tweets without replyToId are standalone.

type TweetItem = string | { text: string; replyToId?: string }

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { tweets?: TweetItem[]; thread?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const tweets = body.tweets || []
  const asThread = body.thread === true

  if (!Array.isArray(tweets) || tweets.length === 0) {
    return NextResponse.json({ error: 'tweets[] is required and must be non-empty' }, { status: 400 })
  }

  const apiKey = process.env.TWITTER_API_KEY
  const apiSecret = process.env.TWITTER_API_SECRET
  const accessToken = process.env.TWITTER_ACCESS_TOKEN
  const accessSecret = process.env.TWITTER_ACCESS_SECRET

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    return NextResponse.json({ error: 'Twitter credentials not configured' }, { status: 500 })
  }

  function oauthSign(method: string, url: string, params: Record<string, string> = {}) {
    const nonce = crypto.randomBytes(16).toString('hex')
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: apiKey!,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: accessToken!,
      oauth_version: '1.0',
      ...params,
    }
    const sortedParams = Object.keys(oauthParams).sort()
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
      .join('&')
    const sigBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`
    const sigKey = `${encodeURIComponent(apiSecret!)}&${encodeURIComponent(accessSecret!)}`
    const signature = crypto.createHmac('sha1', sigKey).update(sigBase).digest('base64')
    oauthParams.oauth_signature = signature
    return 'OAuth ' + Object.keys(oauthParams)
      .filter(k => k.startsWith('oauth_'))
      .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
      .join(', ')
  }

  const results: Array<{ idx: number; ok: boolean; id?: string; error?: string; url?: string }> = []
  let threadReplyToId: string | undefined

  for (let i = 0; i < tweets.length; i++) {
    const item = tweets[i]
    // Normalise into { text, replyToId? }
    const tweet = typeof item === 'string' ? { text: item } : item
    const text = tweet?.text
    if (typeof text !== 'string' || text.trim().length === 0) {
      results.push({ idx: i + 1, ok: false, error: 'Empty tweet text' })
      continue
    }
    const url = 'https://api.twitter.com/2/tweets'
    const reqBody: Record<string, unknown> = { text }

    // Reply precedence: explicit replyToId on the item > thread chain
    const targetReplyId = tweet.replyToId || (asThread ? threadReplyToId : undefined)
    if (targetReplyId) reqBody.reply = { in_reply_to_tweet_id: targetReplyId }

    try {
      const auth = oauthSign('POST', url)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      })
      const data = await res.json()
      if (!res.ok) {
        results.push({ idx: i + 1, ok: false, error: `HTTP ${res.status}: ${JSON.stringify(data)}` })
        if (asThread) break // thread broken if a reply fails; stop
      } else {
        const id = data.data?.id
        results.push({ idx: i + 1, ok: true, id, url: `https://x.com/Match_Mind_AI/status/${id}` })
        if (asThread) threadReplyToId = id
        // Brief pacing to preserve order and avoid burst rate limits
        if (i < tweets.length - 1) await new Promise(r => setTimeout(r, 1200))
      }
    } catch (e: any) {
      results.push({ idx: i + 1, ok: false, error: e.message })
      if (asThread) break
    }
  }

  const allOk = results.every(r => r.ok)
  return NextResponse.json({ success: allOk, count: results.length, results })
}
