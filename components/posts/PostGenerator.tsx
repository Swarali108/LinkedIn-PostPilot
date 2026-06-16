"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type {
  BrandProfile,
  GeneratedPost,
  GenerationInput,
  Goal,
  MemoryHit,
  PostEvaluation,
  PostType,
  Tone,
} from "@/lib/types";

import type { AgentStep } from "@/lib/agents/types";
import { hasUsefulProfile, loadProfile } from "@/lib/profile/store";
import { addHistory, setHistoryScore } from "@/lib/history/store";
import VisualImage from "./VisualImage";

type GenerationResult = GeneratedPost & {
  memoryUsed?: MemoryHit[];
  trace?: AgentStep[];
};

const POST_TYPES: { value: PostType; label: string }[] = [
  { value: "educational", label: "Educational" },
  { value: "story", label: "Story" },
  { value: "opinion", label: "Opinion" },
  { value: "carousel", label: "Carousel Script" },
  { value: "personal-insight", label: "Personal Insight" },
];

const TONES: { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
  { value: "bold", label: "Bold" },
  { value: "inspirational", label: "Inspirational" },
  { value: "educational", label: "Educational" },
  { value: "witty", label: "Witty" },
];

const GOALS: { value: Goal; label: string }[] = [
  { value: "build-authority", label: "Build authority" },
  { value: "grow-audience", label: "Grow audience" },
  { value: "drive-engagement", label: "Drive engagement" },
  { value: "share-learning", label: "Share a learning" },
  { value: "get-job-opportunities", label: "Get job opportunities" },
];

const selectClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-linkedin focus:outline-none focus:ring-1 focus:ring-linkedin";

export default function PostGenerator() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<GenerationInput>({
    topic: searchParams.get("topic") ?? "",
    postType: "educational",
    tone: "professional",
    goal: "build-authority",
    audience: "",
    context: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [activeHook, setActiveHook] = useState(0);
  const [copied, setCopied] = useState(false);
  const [evaluation, setEvaluation] = useState<PostEvaluation | null>(null);
  const [scoring, setScoring] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [useMemory, setUseMemory] = useState(true);
  const [saveToMemory, setSaveToMemory] = useState(true);

  // Load the saved brand profile on mount and default the tone to theirs.
  useEffect(() => {
    loadProfile().then((saved) => {
      if (saved) {
        setProfile(saved);
        setForm((f) => ({
          ...f,
          tone: saved.defaultTone ?? f.tone,
          audience: f.audience || saved.audience,
        }));
      }
    });
  }, []);

  const personalized = hasUsefulProfile(profile);

  async function scorePost(post: string, historyId?: string) {
    setScoring(true);
    setEvaluation(null);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post }),
      });
      const data = await res.json();
      if (res.ok) {
        const evalData = data as PostEvaluation;
        setEvaluation(evalData);
        if (historyId) void setHistoryScore(historyId, evalData.overall);
      }
    } catch {
      // Scoring is best-effort; ignore failures silently.
    } finally {
      setScoring(false);
    }
  }

  function update<K extends keyof GenerationInput>(key: K, value: GenerationInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Pick a different hook → rewrite the post body to open with it.
  async function selectHook(i: number) {
    if (!result || i === activeHook || rewriting) return;
    setActiveHook(i);
    setRewriting(true);
    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          brandProfile: personalized ? profile : undefined,
          useMemory,
          hook: result.hooks[i],
        }),
      });
      const data = await res.json();
      if (res.ok && data.body) {
        setResult((r) => (r ? { ...r, body: data.body } : r));
        void scorePost(data.body);
      }
    } catch {
      // leave the existing post in place on failure
    } finally {
      setRewriting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.topic.trim()) {
      setError("Please enter a topic.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setEvaluation(null);
    setActiveHook(0);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          brandProfile: personalized ? profile : undefined,
          useMemory,
          saveToMemory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      const post = data as GenerationResult;
      setResult(post);
      // Record in history, then score in the background (don't block rendering).
      const historyId = await addHistory({
        topic: form.topic,
        postType: form.postType,
        body: post.body,
      });
      void scorePost(post.body, historyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function fullPostText(): string {
    if (!result) return "";
    const allHashtags = [
      ...result.hashtags.broad,
      ...result.hashtags.medium,
      ...result.hashtags.niche,
    ].join(" ");
    return `${result.body}\n\n${allHashtags}`;
  }

  async function copyAll() {
    await navigator.clipboard.writeText(fullPostText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="h-fit space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        {personalized ? (
          <div className="flex items-center justify-between rounded-lg bg-linkedin/5 px-3 py-2 text-sm text-linkedin">
            <span>
              ✦ Personalized for{" "}
              <strong>{profile?.name || profile?.headline || "you"}</strong>
            </span>
            <Link href="/brand-profile" className="text-xs hover:underline">
              Edit
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <span>Generic output — add a profile to write in your voice.</span>
            <Link href="/brand-profile" className="text-xs font-medium hover:underline">
              Set up
            </Link>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Topic <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.topic}
            onChange={(e) => update("topic", e.target.value)}
            placeholder="e.g. What I learned shipping my first AI feature"
            rows={2}
            className={selectClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Post type
            </label>
            <select
              value={form.postType}
              onChange={(e) => update("postType", e.target.value as PostType)}
              className={selectClass}
            >
              {POST_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tone
            </label>
            <select
              value={form.tone}
              onChange={(e) => update("tone", e.target.value as Tone)}
              className={selectClass}
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Goal
          </label>
          <select
            value={form.goal}
            onChange={(e) => update("goal", e.target.value as Goal)}
            className={selectClass}
          >
            {GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Audience <span className="text-gray-400">(optional)</span>
          </label>
          <input
            value={form.audience}
            onChange={(e) => update("audience", e.target.value)}
            placeholder="e.g. early-career developers"
            className={selectClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Extra context <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={form.context}
            onChange={(e) => update("context", e.target.value)}
            placeholder="Any details, numbers, or story beats to include"
            rows={3}
            className={selectClass}
          />
        </div>

        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={useMemory}
              onChange={(e) => setUseMemory(e.target.checked)}
              className="accent-linkedin"
            />
            Write in my voice using past posts (RAG)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={saveToMemory}
              onChange={(e) => setSaveToMemory(e.target.checked)}
              className="accent-linkedin"
            />
            Save this post to memory
          </label>
          <Link
            href="/brand-memory"
            className="block text-xs text-linkedin hover:underline"
          >
            Manage brand memory →
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-linkedin px-4 py-2.5 font-semibold text-white transition hover:bg-linkedin-dark disabled:opacity-60"
        >
          {loading ? "Generating…" : "Generate post"}
        </button>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </form>

      {/* Results */}
      <div className="space-y-6">
        {!result && !loading && (
          <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-gray-300 text-center text-gray-400">
            Your generated post will appear here.
          </div>
        )}

        {loading && (
          <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
            <div className="animate-pulse text-gray-500">
              Writing your post…
            </div>
          </div>
        )}

        {result && (
          <>
            {/* Agent pipeline trace */}
            {result.trace && result.trace.length > 0 && (
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Agent pipeline
                </h2>
                <ol className="space-y-1.5">
                  {result.trace.map((step) => (
                    <li key={step.name} className="flex items-center gap-3 text-sm">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                          step.status === "ok"
                            ? "bg-green-100 text-green-700"
                            : step.status === "skipped"
                            ? "bg-gray-100 text-gray-400"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {step.status === "ok" ? "✓" : step.status === "skipped" ? "–" : "!"}
                      </span>
                      <span className="w-20 shrink-0 font-medium capitalize text-gray-700">
                        {step.name}
                      </span>
                      <span className="flex-1 truncate text-gray-500">
                        {step.summary}
                      </span>
                      {step.durationMs > 0 && (
                        <span className="shrink-0 text-xs text-gray-400">
                          {(step.durationMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Hooks */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Hooks — pick one to rewrite the post
              </h2>
              <div className="space-y-2">
                {result.hooks.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => selectHook(i)}
                    disabled={rewriting}
                    className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition disabled:opacity-60 ${
                      i === activeHook
                        ? "border-linkedin bg-linkedin/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      {h.style}
                    </span>
                    {h.text}
                  </button>
                ))}
              </div>
            </section>

            {/* Memory used (RAG) */}
            {result.memoryUsed && result.memoryUsed.length > 0 && (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  ✦ Drew on {result.memoryUsed.length} of your past post
                  {result.memoryUsed.length > 1 ? "s" : ""}
                </h2>
                <div className="space-y-1">
                  {result.memoryUsed.map((m) => (
                    <div key={m.id} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700">
                        {(m.similarity * 100).toFixed(0)}%
                      </span>
                      <span className="line-clamp-1">{m.text}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Post body */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Post
                </h2>
                <button
                  onClick={copyAll}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
                >
                  {copied ? "Copied!" : "Copy post + hashtags"}
                </button>
              </div>
              {rewriting ? (
                <p className="animate-pulse text-[15px] text-gray-400">
                  Rewriting the post around your hook…
                </p>
              ) : (
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800">
                  {result.body}
                </p>
              )}
            </section>

            {/* Reach score */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Reach score
                </h2>
                {evaluation && (
                  <span
                    className={`text-2xl font-bold ${
                      evaluation.overall >= 80
                        ? "text-green-600"
                        : evaluation.overall >= 65
                        ? "text-amber-500"
                        : "text-red-500"
                    }`}
                  >
                    {evaluation.overall}
                    <span className="text-sm font-normal text-gray-400">/100</span>
                  </span>
                )}
              </div>

              {scoring && (
                <p className="animate-pulse text-sm text-gray-400">
                  Scoring your post…
                </p>
              )}

              {evaluation && (
                <>
                  <div className="space-y-2">
                    {evaluation.dimensions.map((d) => (
                      <div key={d.dimension} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="capitalize text-gray-700">
                            {d.dimension}
                          </span>
                          <span className="text-gray-500">{d.score}</span>
                        </div>
                        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-linkedin"
                            style={{ width: `${d.score}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-xs text-gray-400">{d.reason}</p>
                      </div>
                    ))}
                  </div>

                  {evaluation.suggestions.length > 0 && (
                    <div className="mt-4">
                      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Suggestions
                      </h3>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                        {evaluation.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Hashtags */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Hashtags
              </h2>
              {(["broad", "medium", "niche"] as const).map((tier) => (
                <div key={tier} className="mb-2">
                  <span className="mr-2 inline-block w-16 text-xs font-medium capitalize text-gray-400">
                    {tier}
                  </span>
                  {result.hashtags[tier].map((tag) => (
                    <span
                      key={tag}
                      className="mr-1.5 inline-block rounded-full bg-linkedin/10 px-2.5 py-0.5 text-sm text-linkedin"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ))}
            </section>

            {/* Visual (image generated from the prompt) */}
            <VisualImage visual={result.visual} />
          </>
        )}
      </div>
    </div>
  );
}
