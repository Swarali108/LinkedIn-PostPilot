"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Eye, Percent, ImageIcon } from "lucide-react";
import {
  summarizeEngagement,
  countHashtags,
  type MemoryItem,
} from "@/lib/analytics/insights";

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Heart;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="mt-3 text-3xl font-bold text-ink">{value}</div>
      <div className="mt-1 text-sm text-ink-muted">{label}</div>
    </div>
  );
}

export default function Engagement() {
  const [memories, setMemories] = useState<MemoryItem[] | null>(null);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    fetch("/api/memory")
      .then(async (r) => {
        if (r.status === 401) {
          setAuthed(false);
          return { memories: [] };
        }
        return r.json();
      })
      .then((d) => setMemories((d.memories ?? []) as MemoryItem[]))
      .catch(() => setMemories([]));
  }, []);

  if (memories === null) return <p className="text-ink-muted">Loading…</p>;

  if (!authed) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-ink-muted">
        Engagement analytics track the real likes & impressions you save to Brand Memory.{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Log in
        </Link>{" "}
        to use it.
      </div>
    );
  }

  const s = summarizeEngagement(memories);
  const tags = countHashtags(memories).slice(0, 8);
  const tracked = memories
    .filter((m) => typeof m.likes === "number" || typeof m.impressions === "number")
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));

  if (s.tracked === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-ink-muted">
        No engagement data yet. Add your past posts with their likes & impressions in{" "}
        <Link href="/brand-memory" className="font-medium text-brand hover:underline">
          Brand Memory
        </Link>{" "}
        and they&apos;ll be analyzed here.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric icon={Heart} label="Total likes" value={s.totalLikes.toLocaleString()} />
        <Metric
          icon={Eye}
          label="Total impressions"
          value={s.totalImpressions.toLocaleString()}
        />
        <Metric
          icon={Percent}
          label="Engagement rate"
          value={s.engagementRate != null ? `${s.engagementRate.toFixed(1)}%` : "—"}
        />
        <Metric icon={ImageIcon} label="Posts with images" value={String(s.withImages)} />
      </div>

      {tags.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="mb-3 text-base font-semibold text-ink">Top hashtags</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t.tag}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-canvas px-3 py-1.5 text-sm text-ink"
              >
                {t.tag}
                <span className="rounded-full bg-brand-soft px-1.5 text-xs font-semibold text-brand">
                  {t.count}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <h2 className="mb-4 text-base font-semibold text-ink">Posts by engagement</h2>
        <div className="space-y-2.5">
          {tracked.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
            >
              <p className="min-w-0 flex-1 truncate text-sm text-ink">{m.text}</p>
              <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-rose-500">
                <Heart className="h-4 w-4" /> {m.likes ?? 0}
              </span>
              <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-ink-muted sm:flex">
                <Eye className="h-4 w-4" /> {(m.impressions ?? 0).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
