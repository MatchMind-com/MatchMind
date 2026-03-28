import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OpenAI key not configured' }, { status: 500 })
    const openai = new OpenAI({ apiKey })
    const formData = await req.formData()
    const image = formData.get('image') as File
    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    const base64 = Buffer.from(await image.arrayBuffer()).toString('base64')
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:${image.type||'image/jpeg'};base64,${base64}`, detail: 'high' } },
        { type: 'text', text: 'Extract bet info from this slip. Return ONLY JSON: {"match_name":"Team A vs Team B","league":"Premier League","bet_type":"Match Result (1X2)","selection":"Team A to Win","odds":2.50,"stake":10.00,"match_date":"2024-01-15"}. Use null for missing fields.' }
      ]}],
      max_tokens: 500,
    })
    const content = response.choices[0].message.content || ''
    const match = content.match(/\{[\s\S]*\}/)
    if (match) return NextResponse.json(JSON.parse(match[0]))
    return NextResponse.json({ error: 'Could not extract data' }, { status: 422 })
  } catch (e: any) {
    if (e?.status === 429) return NextResponse.json({ error: 'OpenAI quota exceeded. Add credits at platform.openai.com/billing' }, { status: 429 })
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 })
  }
}
