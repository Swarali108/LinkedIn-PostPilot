"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HistoryEntry } from "@/lib/types";
import { clearHistory, deleteHistory, listHistory } from "@/lib/history/store";

function scoreColor(score?: number): string {
  if (typeof score !== "number") return "bg-gray-100 text-gray-400";
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 65) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default function PostHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    listHistory().then(setEntries);
  }, []);

  async function remove(id: string) {
    await deleteHistory(id);
    setEntries((e) => e.filter((x) => x.id !== id));
  }

  async function clearAll() {
    await clearHistory();
    setEntries([]);
  }

  async function copy(entry: HistoryEntry) {
    await navigator.clipboard.writeText(entry.body);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-400">
        No posts yet.{" "}
        <Link href="/post-generator" className="text-linkedin hover:underline">
          Generate your first post →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={clearAll}
          className="text-sm text-gray-400 hover:text-red-500"
        >
          Clear all
        </button>
      </div>
      {entries.map((e) => {
        const open = openId === e.id;
        return (
        <div
          key={e.id}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-linkedin/40"
        >
          <button
            type="button"
            onClick={() => setOpenId(open ? null : e.id)}
            className="flex w-full items-start justify-between gap-4 text-left"
          >
            <div>
              <h3 className="font-semibold text-gray-900">{e.topic}</h3>
              <p className="text-xs text-gray-400">
                {new Date(e.createdAt).toLocaleString()} ·{" "}
                <span className="capitalize">{e.postType.replace("-", " ")}</span>
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold ${scoreColor(e.score)}`}
            >
              {typeof e.score === "number" ? e.score : "—"}
            </span>
          </button>
          <p
            className={`mt-2 whitespace-pre-wrap text-sm text-gray-700 ${open ? "" : "line-clamp-4"}`}
          >
            {e.body}
          </p>
          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={() => setOpenId(open ? null : e.id)}
              className="text-sm font-medium text-linkedin hover:underline"
            >
              {open ? "Show less" : "View full post"}
            </button>
            <button
              onClick={() => copy(e)}
              className="text-sm font-medium text-linkedin hover:underline"
            >
              {copiedId === e.id ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() => remove(e.id)}
              className="text-sm text-gray-400 hover:text-red-500"
            >
              Delete
            </button>
          </div>
        </div>
        );
      })}
    </div>
  );
}
