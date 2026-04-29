-- Memory Lane: persistent vector memory for AI Coach
-- Run in Supabase SQL editor.

create extension if not exists vector;

create table if not exists user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  content text not null,
  role text not null check (role in ('user', 'assistant')),
  embedding vector(1536),
  created_at timestamptz default now(),
  conversation_id uuid
);

create index if not exists user_memories_embedding_idx
  on user_memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index if not exists user_memories_user_id_idx
  on user_memories (user_id);

alter table user_memories enable row level security;

drop policy if exists "users own memories" on user_memories;
create policy "users own memories" on user_memories
  for all using (auth.uid() = user_id);

-- RPC for vector similarity search
create or replace function match_user_memories(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int default 5
)
returns table (id uuid, content text, role text, similarity float, created_at timestamptz)
language sql stable as $$
  select id, content, role,
    1 - (embedding <=> query_embedding) as similarity,
    created_at
  from user_memories
  where user_id = match_user_id
  order by embedding <=> query_embedding
  limit match_count;
$$;
