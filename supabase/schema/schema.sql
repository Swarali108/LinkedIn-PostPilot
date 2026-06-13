-- LinkedIn PostPilot — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE.

-- pgvector for semantic memory (all-MiniLM-L6-v2 = 384 dimensions).
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Brand memory (Phase 3/4) — the flagship Supabase-backed store.
-- ---------------------------------------------------------------------------
create table if not exists memories (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default 'local',
  text        text not null,
  type        text not null default 'past-post',   -- 'past-post' | 'generated'
  embedding   vector(384) not null,
  created_at  timestamptz not null default now()
);

create index if not exists memories_user_idx on memories (user_id);

-- Approximate nearest-neighbour index for fast cosine search.
create index if not exists memories_embedding_idx
  on memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Cosine-similarity search, scoped to a user. Returns similarity in [0,1].
create or replace function match_memories (
  query_embedding vector(384),
  match_user_id   text default 'local',
  match_count     int  default 3
)
returns table (
  id         uuid,
  text       text,
  type       text,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    m.id,
    m.text,
    m.type,
    m.created_at,
    1 - (m.embedding <=> query_embedding) as similarity
  from memories m
  where m.user_id = match_user_id
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- Brand profile (Phase 2). One row per user.
-- ---------------------------------------------------------------------------
create table if not exists brand_profiles (
  user_id      text primary key default 'local',
  name         text default '',
  headline     text default '',
  industry     text default '',
  interests    text default '',
  audience     text default '',
  default_tone text default 'professional',
  voice_notes  text default '',
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Generation history / analytics (Phase 7).
-- ---------------------------------------------------------------------------
create table if not exists generation_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default 'local',
  topic       text not null,
  post_type   text not null,
  body        text not null,
  score       int,                                   -- reach score 0-100, null until evaluated
  created_at  timestamptz not null default now()
);

create index if not exists history_user_idx on generation_history (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Content calendars (Phase 6). Plan stored as JSON for flexibility.
-- ---------------------------------------------------------------------------
create table if not exists content_calendars (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default 'local',
  plan        jsonb not null,
  created_at  timestamptz not null default now()
);

-- Note: with auth, replace the 'local' user_id default with auth.uid() and add
-- row-level security policies. This app currently uses the service-role key from
-- server API routes, so RLS is bypassed by design.
