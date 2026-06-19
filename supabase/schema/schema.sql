-- LinkedIn PostPilot — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE.

-- pgvector for semantic memory (Gemini text-embedding-004 = 768 dimensions).
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Brand memory (Phase 3/4) — the flagship Supabase-backed store.
-- ---------------------------------------------------------------------------
create table if not exists memories (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default 'local',
  text        text not null,
  type        text not null default 'past-post',   -- 'past-post' | 'generated'
  embedding   vector(768) not null,
  hashtags    text,
  likes       int,
  impressions int,
  image_url   text,
  created_at  timestamptz not null default now()
);

create index if not exists memories_user_idx on memories (user_id);

-- Approximate nearest-neighbour index for fast cosine search.
create index if not exists memories_embedding_idx
  on memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Cosine-similarity search, scoped to a user. Returns similarity in [0,1].
create or replace function match_memories (
  query_embedding vector(768),
  match_user_id   text default 'local',
  match_count     int  default 3
)
returns table (
  id          uuid,
  text        text,
  type        text,
  created_at  timestamptz,
  hashtags    text,
  likes       int,
  impressions int,
  image_url   text,
  similarity  float
)
language sql stable
set search_path = public          -- pin search_path (resolves advisor warning)
as $$
  select
    m.id,
    m.text,
    m.type,
    m.created_at,
    m.hashtags,
    m.likes,
    m.impressions,
    m.image_url,
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

-- ---------------------------------------------------------------------------
-- Security: enable Row-Level Security on every table.
--
-- This app talks to Supabase ONLY from server routes using the service-role key,
-- which BYPASSES RLS — so the server keeps full access. Enabling RLS with no
-- permissive policies means the public anon/authenticated roles get NO access,
-- which is exactly what we want (and clears the "RLS Disabled in Public" advisor
-- warnings). When you add real auth later, add policies keyed on auth.uid().
-- ---------------------------------------------------------------------------
alter table memories            enable row level security;
alter table brand_profiles      enable row level security;
alter table generation_history  enable row level security;
alter table content_calendars   enable row level security;
