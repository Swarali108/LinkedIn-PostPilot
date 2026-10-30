import type { HistoryEntry, PostType } from "../types";
import { getStorageMode } from "../storage-mode";

/**
 * Generation history (Phase 7).
 *   - Logged-in users → server (Postgres, scoped to their account).
 *   - Guests → sessionStorage (session-only).
 */

const STORAGE_KEY = "postpilot.history";
const MAX_ENTRIES = 100;

function readGuest(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeGuest(entries: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listHistory(): Promise<HistoryEntry[]> {
  if ((await getStorageMode()) === "user") {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (res.ok && data.entries) return data.entries as HistoryEntry[];
    } catch {
      /* fall through */
    }
    return [];
  }
  return readGuest();
}

export async function addHistory(entry: {
  topic: string;
  postType: PostType;
  body: string;
}): Promise<string> {
  if ((await getStorageMode()) === "user") {
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      const data = await res.json();
      if (res.ok && data.entry) return (data.entry as HistoryEntry).id;
    } catch {
      /* fall through */
    }
  }
  const id = makeId();
  writeGuest([
    { id, ...entry, createdAt: new Date().toISOString() },
    ...readGuest().filter((e) => e.id !== id),
  ]);
  return id;
}

export async function setHistoryScore(id: string, score: number): Promise<void> {
  if ((await getStorageMode()) === "user") {
    try {
      await fetch("/api/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, score }),
      });
      return;
    } catch {
      /* fall through */
    }
  }
  writeGuest(readGuest().map((e) => (e.id === id ? { ...e, score } : e)));
}

export async function deleteHistory(id: string): Promise<void> {
  if ((await getStorageMode()) === "user") {
    try {
      await fetch(`/api/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      return;
    } catch {
      /* fall through */
    }
  }
  writeGuest(readGuest().filter((e) => e.id !== id));
}

export async function clearHistory(): Promise<void> {
  if ((await getStorageMode()) === "user") {
    try {
      await fetch("/api/history?all=true", { method: "DELETE" });
      return;
    } catch {
      /* fall through */
    }
  }
  writeGuest([]);
}

export interface HistoryStats {
  total: number;
  scored: number;
  averageScore: number | null;
  bestScore: number | null;
}

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
