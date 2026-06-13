import type { HistoryEntry, PostType } from "../types";

/**
 * Generation history (Phase 7).
 *
 * Two backends behind one async interface:
 *   • Supabase (generation_history) via /api/history — used when the server
 *     reports Supabase is configured.
 *   • localStorage — the zero-setup fallback (per browser).
 *
 * The server's configured-flag is probed once and cached, so localStorage mode
 * doesn't pay a round-trip per call after the first.
 */

const STORAGE_KEY = "postpilot.history";
const MAX_ENTRIES = 100;

// --- localStorage backend ---

function readLocal(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(entries: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- server backend detection (cached) ---

let serverMode: boolean | null = null;

async function useServer(): Promise<boolean> {
  if (serverMode !== null) return serverMode;
  try {
    const res = await fetch("/api/history");
    const data = await res.json();
    serverMode = Boolean(data.configured);
  } catch {
    serverMode = false;
  }
  return serverMode;
}

// --- public async API ---

export async function listHistory(): Promise<HistoryEntry[]> {
  if (await useServer()) {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (data.configured) return data.entries as HistoryEntry[];
    } catch {
      /* fall through to local */
    }
  }
  return readLocal();
}

export async function addHistory(entry: {
  topic: string;
  postType: PostType;
  body: string;
}): Promise<string> {
  if (await useServer()) {
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      const data = await res.json();
      if (data.configured && data.entry) return (data.entry as HistoryEntry).id;
    } catch {
      /* fall through to local */
    }
  }
  const id = makeId();
  writeLocal([
    { id, ...entry, createdAt: new Date().toISOString() },
    ...readLocal().filter((e) => e.id !== id),
  ]);
  return id;
}

export async function setHistoryScore(id: string, score: number): Promise<void> {
  if (await useServer()) {
    try {
      await fetch("/api/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, score }),
      });
      return;
    } catch {
      /* fall through to local */
    }
  }
  writeLocal(readLocal().map((e) => (e.id === id ? { ...e, score } : e)));
}

export async function deleteHistory(id: string): Promise<void> {
  if (await useServer()) {
    try {
      await fetch(`/api/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      return;
    } catch {
      /* fall through to local */
    }
  }
  writeLocal(readLocal().filter((e) => e.id !== id));
}

export async function clearHistory(): Promise<void> {
  if (await useServer()) {
    try {
      await fetch("/api/history?all=true", { method: "DELETE" });
      return;
    } catch {
      /* fall through to local */
    }
  }
  writeLocal([]);
}

export interface HistoryStats {
  total: number;
  scored: number;
  averageScore: number | null;
  bestScore: number | null;
}

/** Compute analytics from a list of entries (pure — callers pass in listHistory()). */
export function statsFrom(entries: HistoryEntry[]): HistoryStats {
  const scores = entries
    .map((e) => e.score)
    .filter((s): s is number => typeof s === "number");
  return {
    total: entries.length,
    scored: scores.length,
    averageScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null,
    bestScore: scores.length ? Math.max(...scores) : null,
  };
}
