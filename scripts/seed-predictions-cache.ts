/**
 * Seed predictions cache locally — run this once after deploying
 * to populate the cache immediately (before the cron fires).
 *
 * Usage:
 *   CRON_SECRET=<your-cron-secret> npx tsx scripts/seed-predictions-cache.ts
 *
 * Or if you have bun:
 *   CRON_SECRET=xxx bun scripts/seed-predictions-cache.ts
 *
 * The CRON_SECRET must match CRON_SECRET in your Vercel environment.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://matchmindcom.com'
const CRON_SECRET = process.env.CRON_SECRET

if (!CRON_SECRET) {
  console.error('❌ Set CRON_SECRET env var before running this script')
  process.exit(1)
}

async function main() {
  console.log(`🔄 Triggering predictions refresh at ${APP_URL}/api/cron/refresh-predictions …`)
  console.log('   This will take 30–60s (API-Football + GPT-4o). Please wait.\n')

  const start = Date.now()
  try {
    const res = await fetch(`${APP_URL}/api/cron/refresh-predictions`, {
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    })
    const data = await res.json()
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    if (res.ok && data.success) {
      console.log(`✅ Cache seeded in ${elapsed}s`)
      console.log(`   ${data.predictions_count} predictions | ${data.leagues_with_fixtures} leagues | ${data.api_failures} API failures`)
      console.log('\n🎉 The predictions page should now load instantly.')
    } else {
      console.error(`❌ Refresh failed (${res.status}) after ${elapsed}s:`, data)
    }
  } catch (e: any) {
    console.error('❌ Network error:', e.message)
  }
}

main()
