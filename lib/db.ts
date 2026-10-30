import { Pool } from "pg";

/**
 * Server-side Postgres pool (Neon). Server-only — DATABASE_URL must never reach
 * the browser. Shared by Better Auth and the data stores.
 *
 * The database is OPTIONAL for local dev: when DATABASE_URL is absent the brand
 * memory store falls back to disk, so the app runs with zero backend setup.
 * (Accounts still need a database.)
 *
 * Use Neon's POOLED connection string (host contains "-pooler") in production —
 * serverless functions open many short-lived connections.
 */

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// Reuse one pool across hot reloads in dev, and across invocations on a warm
// serverless instance.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

/** The shared pool. Constructing it doesn't connect, so this is safe to call at
 * import time (e.g. during `next build`); queries fail if DATABASE_URL is unset. */
export function getPool(): Pool {
  if (!globalForDb.pgPool) {
    globalForDb.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }
  return globalForDb.pgPool;
}

/** Run a parameterized query and return its rows. */
export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!isDbConfigured()) throw new Error("DATABASE_URL is not configured.");
  const { rows } = await getPool().query(text, params);
  return rows as T[];
}
