import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pendingBets } = await supabase
    .from('bet_slips')
    .select('*')
    .eq('user_id', user.id)
    .eq('result', 'pending')

  if (!pendingBets || pendingBets.length === 0) {
    return NextResponse.json({ checked: 0, updated: [] })
  }

  const now = new Date()
  const pastBets = pendingBets.filter(b => {
    if (!b.match_date) return false
    return new Date(b.match_date) < now
  })

  if (pastBets.length === 0) {
    return NextResponse.json({ checked: 0, updated: [] })
  }

  const betList = pastBets.map(b =>
    `ID: ${b.id} | Match: "${b.match_name}" | Date: ${b.match_date} | Type: ${b.bet_type} | Selection: "${b.selection}" | Odds: ${b.odds}`
  ).join('\n')

  const today = now.toISOString().split('T')[0]
  let resultsText = ''

  try {
    // Try OpenAI Responses API with web search
    const resp = await (openai as any).responses.create({
      model: 'gpt-4o',
      tools: [{ type: 'web_search_preview' }],
      input: `Today is ${today}. You are a football results checker. Search the internet and find the actual final scores for these football matches, then determine if each bet WON or LOST.

Bets to check:
${betList}

After searching, return ONLY a JSON array (no markdown, no explanation):
[{"id":"EXACT_BET_ID","result":"win","confidence":"high","match_result":"Arsenal 2-1 Chelsea"}]

Rules:
- result must be exactly: "win", "loss", or "void" (void = postponed/cancelled)
- Only include bets you can find actual results for
- confidence: "high" if you found exact score, "medium" if uncertain, skip bet if no info found`
    })
    resultsText = resp.output_text || ''
  } catch {
    // Fallback to GPT-4o knowledge
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'system',
          content: `You are a football results expert. Today is ${today}. Use your training knowledge to check these bet results. Only provide results you are confident about.`
        }, {
          role: 'user',
          content: `Check these football bets and determine win/loss based on your knowledge:\n${betList}\n\nReturn ONLY a JSON array: [{"id":"BET_ID","result":"win/loss/void","confidence":"high/medium/low","match_result":"score or description"}]\nOnly include bets you know the result of.`
        }],
        max_tokens: 1000,
      })
      resultsText = completion.choices[0]?.message?.content || ''
    } catch (e) {
      console.error('OpenAI error:', e)
    }
  }

  const updated: any[] = []
  try {
    const jsonMatch = resultsText.match(/\[[\s\S]*?\]/)
    if (jsonMatch) {
      const results = JSON.parse(jsonMatch[0])
      for (const r of results) {
        if (!['win', 'loss', 'void'].includes(r.result)) continue
        const bet = pastBets.find(b => b.id === r.id)
        if (!bet) continue
        const profitLoss =
          r.result === 'win' ? bet.stake * (bet.odds - 1)
          : r.result === 'loss' ? -bet.stake
          : 0
        await supabase
          .from('bet_slips')
          .update({ result: r.result, profit_loss: profitLoss })
          .eq('id', r.id)
        updated.push({
          id: r.id,
          result: r.result,
          match_result: r.match_result || '',
          confidence: r.confidence || 'medium',
          match_name: bet.match_name,
        })
      }
    }
  } catch (e) {
    console.error('Parse error:', e)
  }

  return NextResponse.json({ checked: pastBets.length, updated })
}
