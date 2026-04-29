/**
 * Memory Lane — vector memory for the AI Coach.
 *
 * All operations are best-effort. If the migration in supabase/memory-lane.sql
 * hasn't been applied yet, every helper here will swallow the error and return
 * a safe fallback so the AI Coach keeps working.
 */
import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export type Memory = {
  id: string
  content: string
  role: 'user' | 'assistant'
  similarity?: number
  created_at: string
}

/** Embed arbitrary text into a 1536-dim vector. Returns null on failure. */
export async function embedText(text: string): Promise<number[] | null> {
  try {
    const trimmed = (text || '').trim().slice(0, 8000)
    if (!trimmed) return null
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: trimmed,
    })
    return res.data[0]?.embedding ?? null
  } catch (err) {
    console.warn('[memory-lane] embedText failed:', err)
    return null
  }
}

/** Persist a single memory. Silently no-ops if table missing or embed fails. */
export async function saveMemory(
  supabase: SupabaseClient,
  userId: string,
  content: string,
  role: 'user' | 'assistant',
  conversationId?: string,
): Promise<void> {
  try {
    const embedding = await embedText(content)
    if (!embedding) return
    const { error } = await supabase.from('user_memories').insert({
      user_id: userId,
      content,
      role,
      embedding: embedding as any,
      conversation_id: conversationId ?? null,
    })
    if (error) console.warn('[memory-lane] saveMemory insert failed:', error.message)
  } catch (err) {
    console.warn('[memory-lane] saveMemory failed:', err)
  }
}

/** Top-K relevant memories for a query. Returns [] on any failure. */
export async function retrieveMemories(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  limit = 5,
): Promise<Memory[]> {
  try {
    const embedding = await embedText(query)
    if (!embedding) return []
    const { data, error } = await supabase.rpc('match_user_memories', {
      query_embedding: embedding as any,
      match_user_id: userId,
      match_count: limit,
    })
    if (error) {
      console.warn('[memory-lane] retrieveMemories rpc failed:', error.message)
      return []
    }
    return (data || []) as Memory[]
  } catch (err) {
    console.warn('[memory-lane] retrieveMemories failed:', err)
    return []
  }
}
