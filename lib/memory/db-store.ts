import { sql } from "../db";
import { embed } from "../embeddings";
import type { MemoryHit, MemoryMeta, MemoryRecord, MemoryType } from "../types";

/**
 * Postgres (Neon + pgvector) implementation of the brand-memory store.
 *
 * Embeddings come from the Gemini API (768-dim); storage and cosine search live
 * in Postgres. Semantic search uses the `match_memories` function defined in
 * db/schema.sql.
 *
 * Mirrors the function signatures in ./store.ts so the dispatcher there can pick
 * this implementation when DATABASE_URL is configured.
 */

interface MemoryRow {
  id: string;
  user_id?: string;
  text: string;
  type: MemoryType;
  created_at: Date;
  hashtags: string | null;
  likes: number | null;
  impressions: number | null;
  image_url: string | null;
}

const COLUMNS = "id, user_id, text, type, created_at, hashtags, likes, impressions, image_url";

/** pgvector's text input format: '[0.1,0.2,…]'. */
const toVector = (v: number[]) => `[${v.join(",")}]`;

function toHit(r: MemoryRow, similarity: number): MemoryHit {
  return {
    id: r.id,
    text: r.text,
    type: r.type,
    createdAt: new Date(r.created_at).toISOString(),
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
  const [row] = await sql<MemoryRow>(
    `insert into memories (user_id, text, type, embedding, hashtags, likes, impressions, image_url)
     values ($1, $2, $3, $4::vector, $5, $6, $7, $8)
     returning ${COLUMNS}`,
    [
      userId,
      trimmed,
      type,
      toVector(embedding),
      meta.hashtags ?? null,
      meta.likes ?? null,
      meta.impressions ?? null,
      meta.imageUrl ?? null,
    ]
  );
  return {
    ...toHit(row, 1),
    userId: row.user_id ?? userId,
    embedding,
  };
}

export async function listMemories(userId = "local"): Promise<MemoryHit[]> {
  const rows = await sql<MemoryRow>(
    `select ${COLUMNS} from memories where user_id = $1 order by created_at desc`,
    [userId]
  );
  return rows.map((r) => toHit(r, 1));
}

export async function searchMemories(
  query: string,
  k = 3,
  userId = "local"
): Promise<MemoryHit[]> {
  const queryEmbedding = await embed(query);
  const rows = await sql<MemoryRow & { similarity: number }>(
    `select * from match_memories($1::vector, $2, $3)`,
    [toVector(queryEmbedding), userId, k]
  );
  return rows.map((r) => toHit(r, r.similarity));
}

export async function deleteMemory(id: string, userId = "local"): Promise<void> {
  await sql(`delete from memories where id = $1 and user_id = $2`, [id, userId]);
}

export async function clearMemories(userId = "local"): Promise<void> {
  await sql(`delete from memories where user_id = $1`, [userId]);
}
