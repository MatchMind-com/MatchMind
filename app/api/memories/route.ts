import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { retrieveMemories } from '@/lib/memory-lane'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()

  // Vector search path
  if (q) {
    const matches = await retrieveMemories(supabase as any, user.id, q, 25)
    return NextResponse.json({ memories: matches, mode: 'search', count: matches.length })
  }

  // List path — newest first
  try {
    const { data, error, count } = await supabase
      .from('user_memories')
      .select('id, content, role, created_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      // table likely missing — return empty gracefully
      return NextResponse.json({ memories: [], mode: 'list', count: 0, notReady: true })
    }
    return NextResponse.json({ memories: data || [], mode: 'list', count: count ?? data?.length ?? 0 })
  } catch {
    return NextResponse.json({ memories: [], mode: 'list', count: 0, notReady: true })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('user_memories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
