import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    // Truncate to avoid excessive TTS costs on very long responses
    const truncated = text.slice(0, 1000)

    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      input: truncated,
    })

    const arrayBuffer = await response.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(arrayBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    console.error('[voice-tts]', err)
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 })
  }
}
