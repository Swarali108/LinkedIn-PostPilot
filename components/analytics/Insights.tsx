"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { HistoryEntry } from "@/lib/types";
import { listHistory } from "@/lib/history/store";
import { computeInsights, type Insight, type MemoryItem } from "@/lib/analytics/insights";

const TONE = {
  positive: { ring: "border-emerald-200", chip: "bg-emerald-100 text-emerald-700", Icon: TrendingUp },
  warning: { ring: "border-amber-200", chip: "bg-amber-100 text-amber-700", Icon: TrendingDown },
  neutral: { ring: "border-slate-200", chip: "bg-slate-100 text-ink-muted", Icon: Minus },
};

export default function Insights() {
  const [insights, setInsights] = useState<Insight[] | null>(null);

  useEffect(() => {
    (async () => {
      const entries: HistoryEntry[] = await listHistory();
      let memories: MemoryItem[] = [];
      try {
        const r = await fetch("/api/memory");
        if (r.ok) memories = (await r.json()).memories ?? [];
      } catch {
        /* memory is optional */
      }
      setInsights(computeInsights(entries, memories));
    })();
  }, []);

  if (insights === null) return <p className="text-ink-muted">Analyzing your content…</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {insights.map((ins, i) => {
        const tone = TONE[ins.tone];
        const Icon = tone.Icon;
        return (
          <div
            key={i}
            className={`rounded-3xl border bg-white p-6 shadow-soft ${tone.ring}`}
          >
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tone.chip}`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <h3 className="mt-3 font-semibold text-ink">{ins.title}</h3>
            <p className="mt-1 text-sm text-ink-muted">{ins.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
