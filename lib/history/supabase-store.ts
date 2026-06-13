import { getSupabase } from "../supabase/client";
import type { HistoryEntry, PostType } from "../types";

/** Supabase (generation_history table) implementation of the history store. */

interface HistoryRow {
  id: string;
  topic: string;
  post_type: PostType;
  body: string;
  score: number | null;
  created_at: string;
}

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

function toEntry(r: HistoryRow): HistoryEntry {
  return {
    id: r.id,
    topic: r.topic,
    postType: r.post_type,
    body: r.body,
    score: r.score ?? undefined,
    createdAt: r.created_at,
  };
}

export async function listHistory(userId = "local"): Promise<HistoryEntry[]> {
  const { data, error } = await db()
    .from("generation_history")
    .select("id, topic, post_type, body, score, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Supabase history list failed: ${error.message}`);
  return (data as HistoryRow[]).map(toEntry);
}

export async function addHistory(
  entry: { topic: string; postType: PostType; body: string },
  userId = "local"
): Promise<HistoryEntry> {
  const { data, error } = await db()
    .from("generation_history")
    .insert({
      user_id: userId,
      topic: entry.topic,
      post_type: entry.postType,
      body: entry.body,
    })
    .select("id, topic, post_type, body, score, created_at")
    .single();
  if (error) throw new Error(`Supabase history insert failed: ${error.message}`);
  return toEntry(data as HistoryRow);
}

export async function setHistoryScore(id: string, score: number): Promise<void> {
  const { error } = await db()
    .from("generation_history")
    .update({ score })
    .eq("id", id);
  if (error) throw new Error(`Supabase history score update failed: ${error.message}`);
}

export async function deleteHistory(id: string): Promise<void> {
  const { error } = await db().from("generation_history").delete().eq("id", id);
  if (error) throw new Error(`Supabase history delete failed: ${error.message}`);
}

export async function clearHistory(userId = "local"): Promise<void> {
  const { error } = await db()
    .from("generation_history")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(`Supabase history clear failed: ${error.message}`);
}
