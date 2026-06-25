"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PenLine,
  Lightbulb,
  ArrowUpRight,
  Sparkles,
  FileText,
  Hash,
  Rocket,
} from "lucide-react";
import type { BrandProfile, HistoryEntry } from "@/lib/types";
import { loadProfile } from "@/lib/profile/store";
import { listHistory } from "@/lib/history/store";
import { computeScores, brandTips, type BrandScore } from "@/lib/analytics/scores";
import DashboardCalendar from "./DashboardCalendar";

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ScoreCard({ score, featured }: { score: BrandScore; featured?: boolean }) {
  if (featured) {
    return (
      <div className="flex flex-col justify-between rounded-3xl bg-gradient-to-br from-brand to-brand-dark p-6 text-white shadow-lift sm:col-span-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white/80">{score.label}</span>
          <Sparkles className="h-5 w-5 text-white/70" />
        </div>
        <div className="mt-4">
          <div className="text-5xl font-bold tracking-tight">{score.value}</div>
          <div className="mt-1 text-xs text-white/70">{score.hint}</div>
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${score.value}%` }}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <span className="text-sm font-medium text-ink-muted">{score.label}</span>
      <div className="mt-3 text-3xl font-bold text-ink">{score.value}</div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: `${score.value}%` }}
        />
      </div>
      <div className="mt-2 text-[11px] text-ink-muted">{score.hint}</div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [quick, setQuick] = useState("");

  useEffect(() => {
    (async () => {
      setProfile(await loadProfile());
      setEntries(await listHistory());
    })();
  }, []);

  const firstName = (profile?.name || "").split(/\s+/)[0] || "there";
  const scores = useMemo(() => computeScores(entries, profile), [entries, profile]);
  const tips = useMemo(
    () => brandTips(entries, profile, scores),
    [entries, profile, scores]
  );
  const recent = entries.slice(0, 4);

  const topicChips = useMemo(() => {
    const raw = (profile?.interests || "")
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return raw.slice(0, 6);
  }, [profile]);

  function quickCreate(e: React.FormEvent) {
    e.preventDefault();
    const topic = quick.trim();
    router.push(
      topic ? `/post-generator?topic=${encodeURIComponent(topic)}` : "/post-generator"
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero / command bar */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-soft sm:p-9">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {greetingWord()}, {firstName} <span className="align-middle">👋</span>
        </h1>
        <p className="mt-1.5 text-ink-muted">
          Ready to create your next LinkedIn post?
        </p>

        {/* Quick create */}
        <form onSubmit={quickCreate} className="mt-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              placeholder="What's on your mind? e.g. lessons from shipping my first AI product"
              className="flex-1 rounded-xl border border-slate-300 bg-canvas px-4 py-3 text-sm text-ink placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-dark"
            >
              <PenLine className="h-4 w-4" /> Generate Post
            </button>
            <Link
              href="/topic-discovery"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
            >
              <Lightbulb className="h-4 w-4" /> Discover Topics
            </Link>
          </div>
        </form>
      </section>

      {/* Content calendar — prominent, above the fold */}
      <DashboardCalendar />

      {/* Recent drafts + topic suggestions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent drafts (large) */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <FileText className="h-[18px] w-[18px] text-brand" /> Recent Drafts
            </h2>
            {recent.length > 0 && (
              <Link
                href="/post-history"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
              >
                View all <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          {recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-ink-muted">
              No drafts yet.{" "}
              <Link href="/post-generator" className="font-medium text-brand hover:underline">
                Generate your first post →
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recent.map((e) => (
                <Link
                  key={e.id}
                  href={`/post-generator?topic=${encodeURIComponent(e.topic)}`}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition hover:border-brand/30 hover:bg-white hover:shadow-soft"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink">{e.topic}</div>
                    <div className="mt-0.5 truncate text-sm text-ink-muted">{e.body}</div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      Edited {timeAgo(e.createdAt)} ·{" "}
                      <span className="capitalize">{e.postType.replace("-", " ")}</span>
                    </div>
                  </div>
                  {typeof e.score === "number" && (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold ${
                        e.score >= 80
                          ? "bg-emerald-100 text-emerald-700"
                          : e.score >= 65
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {e.score}
                    </span>
                  )}
                  <span className="hidden text-sm font-medium text-brand group-hover:inline">
                    Resume →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Topic suggestions (small) */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
            <Lightbulb className="h-[18px] w-[18px] text-brand" /> Topic Suggestions
          </h2>
          {topicChips.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {topicChips.map((t) => (
                <Link
                  key={t}
                  href={`/post-generator?topic=${encodeURIComponent(t)}`}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-canvas px-3 py-1.5 text-sm text-ink transition hover:border-brand hover:bg-brand-wash hover:text-brand"
                >
                  <Hash className="h-3.5 w-3.5 text-slate-400" />
                  {t}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              Add your interests in your{" "}
              <Link href="/brand-profile" className="font-medium text-brand hover:underline">
                Brand Profile
              </Link>{" "}
              to see tailored ideas here.
            </p>
          )}
          <Link
            href="/topic-discovery"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            Discover more topics <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>
      </div>

      {/* Brand analytics */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Brand Analytics
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {scores.map((s, i) => (
            <ScoreCard key={s.key} score={s} featured={i === 0} />
          ))}
        </div>

        {/* Tips to improve brand strength */}
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Rocket className="h-[18px] w-[18px] text-brand" /> Boost your Brand Strength
          </h3>
          <ul className="mt-4 space-y-2.5">
            {tips.map((t, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm text-ink">{t.text}</span>
                <Link
                  href={t.href}
                  className="shrink-0 rounded-lg bg-brand-wash px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand-soft"
                >
                  {t.cta}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
