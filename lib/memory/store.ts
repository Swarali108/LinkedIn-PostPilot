import { promises as fs } from "fs";
import path from "path";
import { cosineSimilarity, embed } from "../embeddings";
import { isSupabaseConfigured } from "../supabase/client";
import * as supabaseStore from "./supabase-store";
import type { MemoryHit, MemoryRecord, MemoryType } from "../types";

/**
 * Brand-memory vector store (Phase 3/4).
 *
 * Two backends behind one interface:
 *   • Supabase pgvector — used when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are
 *     set. Persists across serverless invocations; this is the production path.
 *   • Disk JSON (below) — the zero-setup local fallback. Persists in local dev
 *     but NOT on serverless hosts (ephemeral filesystem).
 *
 * Embeddings are computed locally with all-MiniLM-L6-v2 in both cases. The
 * exported functions dispatch to whichever backend is configured.
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
  userId = "local"
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
  };
  await persist([record, ...records]);
  return record;
}

async function diskListMemories(userId = "local"): Promise<MemoryHit[]> {
  const records = await load();
  return records
    .filter((r) => r.userId === userId)
    .map(({ id, text, type, createdAt }) => ({
      id,
      text,
      type,
      createdAt,
      similarity: 1,
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

/** Embed and store a piece of the user's writing. */
export function addMemory(
  text: string,
  type: MemoryType,
  userId = "local"
): Promise<MemoryRecord> {
  return isSupabaseConfigured()
    ? supabaseStore.addMemory(text, type, userId)
    : diskAddMemory(text, type, userId);
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
