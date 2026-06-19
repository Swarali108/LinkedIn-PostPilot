import { promises as fs } from "fs";
import path from "path";
import { cosineSimilarity, embed } from "../embeddings";
import { isSupabaseConfigured } from "../supabase/client";
import * as supabaseStore from "./supabase-store";
import type { MemoryHit, MemoryMeta, MemoryRecord, MemoryType } from "../types";

function metaOf(r: MemoryRecord): MemoryMeta {
  return {
    hashtags: r.hashtags,
    likes: r.likes,
    impressions: r.impressions,
    imageUrl: r.imageUrl,
  };
}

/**
 * Brand-memory vector store (Phase 3/4).
 *
 * Two backends behind one interface:
 *   • Supabase pgvector — used when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are
 *     set. Persists across serverless invocations; this is the production path.
 *   • Disk JSON (below) — the zero-setup local fallback. Persists in local dev
 *     but NOT on serverless hosts (ephemeral filesystem).
 *
 * Embeddings come from the Gemini API (768-dim) in both cases. The exported
 * functions dispatch to whichever backend is configured.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "memory.json");

let cache: MemoryRecord[] | null = null;

async function load(): Promise<MemoryRecord[]> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    cache = JSON.parse(raw) as MemoryRecord[];
  } catch {
    cache = [];
  }
  return cache;
}

async function persist(records: MemoryRecord[]): Promise<void> {
  cache = records;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(records, null, 2), "utf-8");
}

function makeId(): string {
  // Date.now()/Math.random() are fine in app runtime (not in workflow scripts).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function diskAddMemory(
  text: string,
  type: MemoryType,
  userId = "local",
  meta: MemoryMeta = {}
): Promise<MemoryRecord> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Cannot store empty memory.");

  const records = await load();
  const embedding = await embed(trimmed);
  const record: MemoryRecord = {
    id: makeId(),
    userId,
    text: trimmed,
    type,
    embedding,
    createdAt: new Date().toISOString(),
    hashtags: meta.hashtags,
    likes: meta.likes,
    impressions: meta.impressions,
    imageUrl: meta.imageUrl,
  };
  await persist([record, ...records]);
  return record;
}

async function diskListMemories(userId = "local"): Promise<MemoryHit[]> {
  const records = await load();
  return records
    .filter((r) => r.userId === userId)
    .map((r) => ({
      id: r.id,
      text: r.text,
      type: r.type,
      createdAt: r.createdAt,
      similarity: 1,
      ...metaOf(r),
    }));
}

async function diskSearchMemories(
  query: string,
  k = 3,
  userId = "local"
): Promise<MemoryHit[]> {
  const records = (await load()).filter((r) => r.userId === userId);
  if (records.length === 0) return [];

  const queryEmbedding = await embed(query);
  return records
    .map((r) => ({
      id: r.id,
      text: r.text,
      type: r.type,
      createdAt: r.createdAt,
      similarity: cosineSimilarity(queryEmbedding, r.embedding),
      ...metaOf(r),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

async function diskDeleteMemory(id: string): Promise<void> {
  const records = await load();
  await persist(records.filter((r) => r.id !== id));
}

async function diskClearMemories(userId = "local"): Promise<void> {
  const records = await load();
  await persist(records.filter((r) => r.userId !== userId));
}

// --- Public API: dispatch to Supabase when configured, else disk fallback. ---

/** Embed and store a piece of the user's writing (with optional engagement meta). */
export function addMemory(
  text: string,
  type: MemoryType,
  userId = "local",
  meta: MemoryMeta = {}
): Promise<MemoryRecord> {
  return isSupabaseConfigured()
    ? supabaseStore.addMemory(text, type, userId, meta)
    : diskAddMemory(text, type, userId, meta);
}

/** All memories for a user, newest first, without embeddings. */
export function listMemories(userId = "local"): Promise<MemoryHit[]> {
  return isSupabaseConfigured()
    ? supabaseStore.listMemories(userId)
    : diskListMemories(userId);
}

/** Semantic search: embed the query and return the top-k most similar memories. */
export function searchMemories(
  query: string,
  k = 3,
  userId = "local"
): Promise<MemoryHit[]> {
  return isSupabaseConfigured()
    ? supabaseStore.searchMemories(query, k, userId)
    : diskSearchMemories(query, k, userId);
}

export function deleteMemory(id: string): Promise<void> {
  return isSupabaseConfigured()
    ? supabaseStore.deleteMemory(id)
    : diskDeleteMemory(id);
}

export function clearMemories(userId = "local"): Promise<void> {
  return isSupabaseConfigured()
    ? supabaseStore.clearMemories(userId)
    : diskClearMemories(userId);
}

/** The user's previously-used hashtags, deduped and ordered by engagement
 * (likes + impressions/100), so generation can reuse what has worked. */
export async function getProvenHashtags(
  userId = "local",
  limit = 15
): Promise<string[]> {
  const mems = await listMemories(userId);
  const score = (m: { likes?: number; impressions?: number }) =>
    (m.likes ?? 0) + (m.impressions ?? 0) / 100;
  const ranked = mems
    .filter((m) => m.hashtags && m.hashtags.trim())
    .sort((a, b) => score(b) - score(a));

  const tags: string[] = [];
  for (const m of ranked) {
    for (const tok of m.hashtags!.split(/[\s,]+/).filter(Boolean)) {
      const tag = tok.startsWith("#") ? tok : `#${tok}`;
      if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);
      if (tags.length >= limit) return tags;
    }
  }
  return tags;
}
