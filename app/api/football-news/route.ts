import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const { query = 'Premier League La Liga football news injuries lineups' } = await req.json()
  const today = new Date().toISOString().split('T')[0]

  const prompt = `Today is ${today}. Search for the very latest football news and return structured results.

Focus on: ${query}

Include: injury reports, team news, lineup updates, match previews, and key transfer gossip.
Prioritise news from the last 48 hours.

Return ONLY a valid JSON array (no markdown):
[
  {
    "title": "short compelling headline",
    "summary": "2-3 sentence factual summary",
    "category": "injury|lineup|transfer|match_result|preview|other",
    "league": "e.g. Premier League",
    "team": "e.g. Arsenal",
    "urgency": "high|medium|low",
    "timestamp": "e.g. 2 hours ago"
  }
]

Return 8-12 items covering multiple leagues.`

  try {
    const resp = await (openai as any).responses.create({
      model: 'gpt-4o',
      tools: [{ type: 'web_search_preview' }],
      input: prompt,
    })
    const text = resp.output_text || ''
    const jsonMatch = text.match(/\[[\s\S]*?\](?=\s*$)/) || text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return NextResponse.json({ news: JSON.parse(jsonMatch[0]), source: 'web' })
    }
  } catch { /* fall through */ }

  // Fallback: GPT knowledge
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: `You are a football news expert. Today is ${today}. Generate realistic recent football news items based on your training knowledge.`
      }, {
        role: 'user',
        content: `Generate 10 recent football news items related to: ${query}. Format as JSON array only: [{"title":"...","summary":"...","category":"injury|lineup|transfer|match_result|preview","league":"...","team":"...","urgency":"high|medium|low","timestamp":"X hours ago"}]`,
      }],
      max_tokens: 1500,
    })
    const text = completion.choices[0]?.message?.content || ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return NextResponse.json({ news: JSON.parse(jsonMatch[0]), source: 'ai' })
    }
  } catch (e) {
    console.error('News error:', e)
  }

  return NextResponse.json({ news: [], source: 'none' })
}
