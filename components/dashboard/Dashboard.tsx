"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BrandProfile, HistoryEntry } from "@/lib/types";
import { loadProfile } from "@/lib/profile/store";
import { listHistory, statsFrom, type HistoryStats } from "@/lib/history/store";

const TOOLS = [
  {
    href: "/post-generator",
    title: "Post Generator",
    desc: "Topic → hooks, post, hashtags, visual, score.",
    accent: "bg-linkedin text-white",
  },
  {
    href: "/topic-discovery",
    title: "Topic Discovery",
    desc: "Personalized, non-generic topic ideas.",
    accent: "bg-rose-100 text-rose-700",
  },
  {
    href: "/content-calendar",
    title: "Content Calendar",
    desc: "Plan a consistent posting schedule.",
    accent: "bg-amber-100 text-amber-700",
  },
  {
    href: "/brand-profile",
    title: "Brand Profile",
    desc: "Define your voice and audience.",
    accent: "bg-violet-100 text-violet-700",
  },
  {
    href: "/brand-memory",
    title: "Brand Memory",
    desc: "Past posts, embedded for RAG.",
    accent: "bg-emerald-100 text-emerald-700",
  },
  {
    href: "/post-history",
    title: "Post History",
    desc: "Everything you've generated.",
    accent: "bg-sky-100 text-sky-700",
  },
];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="mt-1 text-sm text-gray-500">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [stats, setStats] = useState<HistoryStats>({
    total: 0,
    scored: 0,
    averageScore: null,
    bestScore: null,
  });
  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setProfile(await loadProfile());
      const entries = await listHistory();
      setStats(statsFrom(entries));
      setRecent(entries.slice(0, 5));
    })();

    fetch("/api/memory")
      .then((r) => r.json())
      .then((d) => setMemoryCount(d.memories?.length ?? 0))
      .catch(() => setMemoryCount(null));
  }, []);

  const greeting = profile?.name ? `Welcome back, ${profile.name}` : "Welcome to PostPilot";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{greeting}</h1>
        <p className="text-gray-600">
          {profile?.headline || "Your personal LinkedIn operating system."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Posts generated" value={String(stats.total)} />
        <StatCard
          label="Avg reach score"
          value={stats.averageScore != null ? String(stats.averageScore) : "—"}
        />
        <StatCard
          label="Best score"
          value={stats.bestScore != null ? String(stats.bestScore) : "—"}
        />
        <StatCard
          label="Memories stored"
          value={memoryCount != null ? String(memoryCount) : "…"}
        />
      </div>

      {/* Tools */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Tools
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-linkedin hover:shadow"
            >
              <span
                className={`mb-3 inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${t.accent}`}
              >
                {t.title}
              </span>
              <p className="text-sm text-gray-600">{t.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent posts */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Recent posts
          </h2>
          {recent.length > 0 && (
            <Link href="/post-history" className="text-sm text-linkedin hover:underline">
              View all →
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-400">
            No posts yet.{" "}
            <Link href="/post-generator" className="text-linkedin hover:underline">
              Generate your first post →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-gray-900">{e.topic}</div>
                  <div className="truncate text-sm text-gray-500">{e.body}</div>
                </div>
                {typeof e.score === "number" && (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold ${
                      e.score >= 80
                        ? "bg-green-100 text-green-700"
                        : e.score >= 65
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {e.score}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
