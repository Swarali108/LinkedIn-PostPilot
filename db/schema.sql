-- LinkedIn PostPilot — Postgres schema (Neon)
-- Run once against your Neon database:  psql "$DATABASE_URL" -f db/schema.sql
-- (or paste into Neon Console → SQL Editor). Safe to re-run.

-- pgvector for semantic memory (Gemini gemini-embedding-001 = 768 dimensions).
create extension if not exists vector;

-- ===========================================================================
-- Auth (Better Auth). Column names are camelCase because that's what Better
-- Auth expects. Login is by `username`; email is for confirm/reset only.
-- ===========================================================================
create table if not exists "user" (
  id              text primary key,
  name            text not null,
  email           text not null unique,
  "emailVerified" boolean not null default false,
  image           text,
  username        text unique,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now()
);

create table if not exists session (
  id          text primary key,
  "expiresAt" timestamptz not null,
  token       text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId"    text not null references "user"(id) on delete cascade
);
create index if not exists session_user_idx on session ("userId");

-- One row per login method; email+password users have providerId = 'credential'
-- and their password hash in `password`.
create table if not exists account (
  id                      text primary key,
  "accountId"             text not null,
  "providerId"            text not null,
  "userId"                text not null references "user"(id) on delete cascade,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope                   text,
  password                text,
  "createdAt"             timestamptz not null default now(),
  "updatedAt"             timestamptz not null default now()
);
create index if not exists account_user_idx on account ("userId");

-- One-time tokens (email confirmation, password reset).
create table if not exists verification (
  id          text primary key,
  identifier  text not null,
  value       text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists verification_identifier_idx on verification (identifier);

-- ===========================================================================
-- App data. `user_id` is the Better Auth user id ("user".id). Every query is
-- scoped by the authenticated user's id on the server.
-- ===========================================================================

-- Brand memory — past posts embedded for semantic search.
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
set search_path = public
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

-- Brand profile. One row per user.
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

-- Generation history / analytics.
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

-- Content calendars. Plan stored as JSON for flexibility.
create table if not exists content_calendars (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default 'local',
  plan        jsonb not null,
  created_at  timestamptz not null default now()
);
