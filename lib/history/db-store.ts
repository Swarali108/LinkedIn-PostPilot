import { sql } from "../db";
import type { HistoryEntry, PostType } from "../types";

/** Postgres (generation_history table) implementation of the history store. */

interface HistoryRow {
  id: string;
  topic: string;
  post_type: PostType;
  body: string;
  score: number | null;
  created_at: Date;
}

const COLUMNS = "id, topic, post_type, body, score, created_at";

function toEntry(r: HistoryRow): HistoryEntry {
  return {
    id: r.id,
    topic: r.topic,
    postType: r.post_type,
    body: r.body,
    score: r.score ?? undefined,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function listHistory(userId = "local"): Promise<HistoryEntry[]> {
  const rows = await sql<HistoryRow>(
    `select ${COLUMNS} from generation_history
      where user_id = $1 order by created_at desc limit 100`,
    [userId]
  );
  return rows.map(toEntry);
}

export async function addHistory(
  entry: { topic: string; postType: PostType; body: string },
  userId = "local"
): Promise<HistoryEntry> {
  const [row] = await sql<HistoryRow>(
    `insert into generation_history (user_id, topic, post_type, body)
     values ($1, $2, $3, $4) returning ${COLUMNS}`,
    [userId, entry.topic, entry.postType, entry.body]
  );
  return toEntry(row);
}

export async function setHistoryScore(id: string, score: number, userId = "local"): Promise<void> {
  await sql(`update generation_history set score = $1 where id = $2 and user_id = $3`, [
    score,
    id,
    userId,
  ]);
}

export async function deleteHistory(id: string, userId = "local"): Promise<void> {
  await sql(`delete from generation_history where id = $1 and user_id = $2`, [id, userId]);
}

export async function clearHistory(userId = "local"): Promise<void> {
  await sql(`delete from generation_history where user_id = $1`, [userId]);
}
