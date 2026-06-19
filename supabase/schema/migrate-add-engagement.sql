-- Migration: add engagement + media metadata to memories, and surface it from
-- match_memories. Run ONCE in the Supabase SQL editor if you created the schema
-- before these columns existed. Safe on a table with data (columns are nullable).

alter table memories add column if not exists hashtags    text;
alter table memories add column if not exists likes       int;
alter table memories add column if not exists impressions int;
alter table memories add column if not exists image_url   text;

-- The RPC's return signature changes, so it must be dropped before recreating.
drop function if exists match_memories(vector, text, integer);

create function match_memories (
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
