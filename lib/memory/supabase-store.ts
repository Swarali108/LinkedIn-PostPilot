import { getSupabase } from "../supabase/client";
import { embed } from "../embeddings";
import type { MemoryHit, MemoryMeta, MemoryRecord, MemoryType } from "../types";

/**
 * Supabase (pgvector) implementation of the brand-memory store.
 *
 * Embeddings come from the Gemini API (768-dim); storage and cosine search live
 * in Postgres. Semantic search uses the `match_memories` RPC defined in
 * supabase/schema/schema.sql.
 *
 * Mirrors the function signatures in ./store.ts so the dispatcher there can pick
 * this implementation when Supabase is configured.
 */

interface MemoryRow {
  id: string;
  user_id?: string;
  text: string;
  type: MemoryType;
  created_at: string;
  hashtags: string | null;
  likes: number | null;
  impressions: number | null;
  image_url: string | null;
}

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

function toHit(r: MemoryRow, similarity: number): MemoryHit {
  return {
    id: r.id,
    text: r.text,
    type: r.type,
    createdAt: r.created_at,
    hashtags: r.hashtags ?? undefined,
    likes: r.likes ?? undefined,
    impressions: r.impressions ?? undefined,
    imageUrl: r.image_url ?? undefined,
    similarity,
  };
}

export async function addMemory(
  text: string,
  type: MemoryType,
  userId = "local",
  meta: MemoryMeta = {}
): Promise<MemoryRecord> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Cannot store empty memory.");

  const embedding = await embed(trimmed);
  const { data, error } = await db()
    .from("memories")
    .insert({
      user_id: userId,
      text: trimmed,
      type,
      embedding,
      hashtags: meta.hashtags ?? null,
      likes: meta.likes ?? null,
      impressions: meta.impressions ?? null,
      image_url: meta.imageUrl ?? null,
    })
    .select("id, user_id, text, type, created_at, hashtags, likes, impressions, image_url")
    .single();

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  const row = data as MemoryRow;
  return {
    id: row.id,
    userId: row.user_id ?? userId,
    text: row.text,
    type: row.type,
    embedding,
    createdAt: row.created_at,
    hashtags: row.hashtags ?? undefined,
    likes: row.likes ?? undefined,
    impressions: row.impressions ?? undefined,
    imageUrl: row.image_url ?? undefined,
  };
}

export async function listMemories(userId = "local"): Promise<MemoryHit[]> {
  const { data, error } = await db()
    .from("memories")
    .select("id, text, type, created_at, hashtags, likes, impressions, image_url")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Supabase list failed: ${error.message}`);
  return (data as MemoryRow[]).map((r) => toHit(r, 1));
}

export async function searchMemories(
  query: string,
  k = 3,
  userId = "local"
): Promise<MemoryHit[]> {
  const queryEmbedding = await embed(query);
  const { data, error } = await db().rpc("match_memories", {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: k,
  });

  if (error) throw new Error(`Supabase search failed: ${error.message}`);
  return (data as (MemoryRow & { similarity: number })[]).map((r) =>
    toHit(r, r.similarity)
  );
}

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await db().from("memories").delete().eq("id", id);
  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
}

export async function clearMemories(userId = "local"): Promise<void> {
  const { error } = await db().from("memories").delete().eq("user_id", userId);
  if (error) throw new Error(`Supabase clear failed: ${error.message}`);
}
