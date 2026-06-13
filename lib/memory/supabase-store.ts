import { getSupabase } from "../supabase/client";
import { embed } from "../embeddings";
import type { MemoryHit, MemoryRecord, MemoryType } from "../types";

/**
 * Supabase (pgvector) implementation of the brand-memory store.
 *
 * Embeddings are still computed locally with all-MiniLM-L6-v2; only storage and
 * cosine search move to Postgres. Semantic search uses the `match_memories` RPC
 * defined in supabase/schema/schema.sql.
 *
 * Mirrors the function signatures in ./store.ts so the dispatcher there can pick
 * this implementation when Supabase is configured.
 */

interface MemoryRow {
  id: string;
  user_id: string;
  text: string;
  type: MemoryType;
  created_at: string;
}

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

export async function addMemory(
  text: string,
  type: MemoryType,
  userId = "local"
): Promise<MemoryRecord> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Cannot store empty memory.");

  const embedding = await embed(trimmed);
  const { data, error } = await db()
    .from("memories")
    .insert({ user_id: userId, text: trimmed, type, embedding })
    .select("id, user_id, text, type, created_at")
    .single();

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  const row = data as MemoryRow;
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text,
    type: row.type,
    embedding,
    createdAt: row.created_at,
  };
}

export async function listMemories(userId = "local"): Promise<MemoryHit[]> {
  const { data, error } = await db()
    .from("memories")
    .select("id, text, type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Supabase list failed: ${error.message}`);
  return (data as MemoryRow[]).map((r) => ({
    id: r.id,
    text: r.text,
    type: r.type,
    createdAt: r.created_at,
    similarity: 1,
  }));
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
  return (data as (MemoryRow & { similarity: number })[]).map((r) => ({
    id: r.id,
    text: r.text,
    type: r.type,
    createdAt: r.created_at,
    similarity: r.similarity,
  }));
}

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await db().from("memories").delete().eq("id", id);
  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
}

export async function clearMemories(userId = "local"): Promise<void> {
  const { error } = await db().from("memories").delete().eq("user_id", userId);
  if (error) throw new Error(`Supabase clear failed: ${error.message}`);
}
