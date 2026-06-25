"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ArrowUpRight, Plus } from "lucide-react";
import type { CalendarPlan, PlannedPost } from "@/lib/types";
import { loadCalendar } from "@/lib/calendar/store";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function DashboardCalendar() {
  const [plan, setPlan] = useState<CalendarPlan | null>(null);

  useEffect(() => {
    setPlan(loadCalendar());
  }, []);

  // Next 7 days, starting today.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const byDate: Record<string, PlannedPost[]> = {};
  for (const p of plan?.posts ?? []) {
    if (p.date) (byDate[p.date] ??= []).push(p);
  }
  const upcomingCount = days.reduce((n, d) => n + (byDate[ymd(d)]?.length ?? 0), 0);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <CalendarDays className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink">Content Calendar</h2>
            <p className="text-xs text-ink-muted">
              {upcomingCount > 0
                ? `${upcomingCount} post${upcomingCount === 1 ? "" : "s"} planned this week`
                : "Plan a consistent posting rhythm"}
            </p>
          </div>
        </div>
        <Link
          href="/content-calendar"
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand transition hover:bg-brand-wash"
        >
          Open <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((d, i) => {
          const key = ymd(d);
          const posts = byDate[key] ?? [];
          const isToday = i === 0;
          return (
            <div
              key={key}
              className={`flex min-h-[112px] flex-col rounded-2xl border p-2 ${
                isToday ? "border-brand/40 bg-brand-wash" : "border-slate-100 bg-slate-50/60"
              }`}
            >
              <div className="mb-1.5 px-0.5 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div
                  className={`text-sm font-bold ${isToday ? "text-brand" : "text-ink"}`}
                >
                  {d.getDate()}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                {posts.slice(0, 3).map((p, j) => (
                  <Link
                    key={j}
                    href={`/post-generator?topic=${encodeURIComponent(p.topic)}`}
                    title={`${p.topic} — ${p.angle}`}
                    className="truncate rounded-lg bg-white px-1.5 py-1 text-[10px] font-medium text-ink shadow-sm ring-1 ring-slate-100 transition hover:ring-brand/40"
                  >
                    {p.topic}
                  </Link>
                ))}
                {posts.length > 3 && (
                  <span className="px-1 text-[10px] text-ink-muted">
                    +{posts.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {upcomingCount === 0 && (
        <Link
          href="/content-calendar"
          className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-ink-muted transition hover:border-brand hover:text-brand"
        >
          <Plus className="h-4 w-4" /> Generate a content plan
        </Link>
      )}
    </section>
  );
}
