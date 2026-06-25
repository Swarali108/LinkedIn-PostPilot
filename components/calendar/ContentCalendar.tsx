"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CalendarPlan, PlannedPost } from "@/lib/types";
import { loadProfile } from "@/lib/profile/store";
import { saveCalendar } from "@/lib/calendar/store";

const PILLAR_COLORS = [
  "bg-rose-50 text-rose-600",
  "bg-violet-50 text-violet-600",
  "bg-emerald-50 text-emerald-600",
  "bg-amber-50 text-amber-600",
  "bg-sky-50 text-sky-600",
];

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-linkedin focus:outline-none focus:ring-1 focus:ring-linkedin";

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function ContentCalendar() {
  const [industry, setIndustry] = useState("");
  const [interests, setInterests] = useState("");
  const [audience, setAudience] = useState("");
  const [durationWeeks, setDurationWeeks] = useState(1);
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<CalendarPlan | null>(null);

  // Prefill from the saved brand profile.
  useEffect(() => {
    loadProfile().then((p) => {
      if (p) {
        setIndustry((cur) => cur || p.industry);
        setInterests((cur) => cur || p.interests);
        setAudience((cur) => cur || p.audience);
      }
    });
  }, []);

  function pillarColor(plan: CalendarPlan, pillar: string): string {
    const idx = plan.pillars.indexOf(pillar);
    return PILLAR_COLORS[(idx < 0 ? 0 : idx) % PILLAR_COLORS.length];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!industry.trim()) {
      setError("Please enter your industry.");
      return;
    }
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry,
          interests,
          audience,
          durationWeeks,
          postsPerWeek,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate calendar.");
      setPlan(data as CalendarPlan);
      saveCalendar(data as CalendarPlan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const byWeek: Record<number, PlannedPost[]> = {};
  if (plan) {
    for (const post of plan.posts) {
      (byWeek[post.week] ??= []).push(post);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="lg:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Industry <span className="text-red-500">*</span>
          </label>
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="AI engineering"
            className={inputClass}
          />
        </div>
        <div className="lg:col-span-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Interests <span className="text-gray-400">(optional)</span>
          </label>
          <input
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="RAG, developer experience, career growth"
            className={inputClass}
          />
        </div>
        <div className="lg:col-span-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Audience <span className="text-gray-400">(optional)</span>
          </label>
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="early-career developers"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Weeks
          </label>
          <select
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(Number(e.target.value))}
            className={inputClass}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "week" : "weeks"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Posts / week
          </label>
          <select
            value={postsPerWeek}
            onChange={(e) => setPostsPerWeek(Number(e.target.value))}
            className={inputClass}
          >
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end lg:col-span-5">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-linkedin px-5 py-2.5 font-semibold text-white transition hover:bg-linkedin-dark disabled:opacity-60"
          >
            {loading ? "Planning…" : "Generate calendar"}
          </button>
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 lg:col-span-5">
            {error}
          </p>
        )}
      </form>

      {plan && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Pillars:</span>
            {plan.pillars.map((p) => (
              <span
                key={p}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pillarColor(plan, p)}`}
              >
                {p}
              </span>
            ))}
          </div>

          {Object.keys(byWeek)
            .map(Number)
            .sort((a, b) => a - b)
            .map((week) => (
              <div key={week}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
                  Week {week}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {byWeek[week].map((post, i) => (
                    <div
                      key={i}
                      className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">
                          {formatDate(post.date)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${pillarColor(plan, post.pillar)}`}
                        >
                          {post.pillar}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900">{post.topic}</h3>
                      <p className="mt-1 flex-1 text-sm text-gray-600">
                        {post.angle}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs capitalize text-gray-500">
                          {post.postType.replace("-", " ")}
                        </span>
                        <Link
                          href={`/post-generator?topic=${encodeURIComponent(post.topic)}`}
                          className="text-sm font-medium text-linkedin hover:underline"
                        >
                          Write →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
