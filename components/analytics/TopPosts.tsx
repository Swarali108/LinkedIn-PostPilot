"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, ArrowUpRight } from "lucide-react";
import type { HistoryEntry } from "@/lib/types";
import { listHistory } from "@/lib/history/store";

function scoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-100 text-emerald-700";
  if (score >= 65) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

const RANK = ["bg-amber-400 text-white", "bg-slate-300 text-white", "bg-amber-700/80 text-white"];

export default function TopPosts() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    listHistory().then(setEntries);
  }, []);

  if (entries === null) {
    return <p className="text-ink-muted">Loading…</p>;
  }

  const ranked = entries
    .filter((e) => typeof e.score === "number")
    .sort((a, b) => (b.score as number) - (a.score as number))
    .slice(0, 10);

  if (ranked.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-ink-muted">
        No scored posts yet.{" "}
        <Link href="/post-generator" className="font-medium text-brand hover:underline">
          Generate a post →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ranked.map((e, i) => (
        <div
          key={e.id}
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              RANK[i] ?? "bg-slate-100 text-ink-muted"
            }`}
          >
            {i < 3 ? <Trophy className="h-4 w-4" /> : i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-ink">{e.topic}</div>
            <div className="truncate text-sm text-ink-muted">{e.body}</div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              {new Date(e.createdAt).toLocaleDateString()} ·{" "}
              <span className="capitalize">{e.postType.replace("-", " ")}</span>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${scoreColor(
              e.score as number
            )}`}
          >
            {e.score}
          </span>
          <Link
            href={`/post-generator?topic=${encodeURIComponent(e.topic)}`}
            className="hidden shrink-0 items-center gap-1 text-sm font-medium text-brand hover:underline sm:inline-flex"
          >
            Reuse <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      ))}
    </div>
  );
}
