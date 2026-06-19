"use client";

import { useEffect, useState } from "react";
import type { MemoryHit } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-linkedin focus:outline-none focus:ring-1 focus:ring-linkedin";

export default function BrandMemory() {
  const [memories, setMemories] = useState<MemoryHit[]>([]);
  const [text, setText] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [likes, setLikes] = useState("");
  const [impressions, setImpressions] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/memory");
      const data = await res.json();
      if (res.ok) setMemories(data.memories as MemoryHit[]);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addPost(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          hashtags: hashtags.trim() || undefined,
          likes: likes ? Number(likes) : undefined,
          impressions: impressions ? Number(impressions) : undefined,
          imageUrl: imageUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setText("");
      setHashtags("");
      setLikes("");
      setImpressions("");
      setImageUrl("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/memory?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setMemories((m) => m.filter((x) => x.id !== id));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form
        onSubmit={addPost}
        className="h-fit space-y-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="font-semibold text-gray-900">Add a past post</h2>
        <p className="text-sm text-gray-600">
          Paste a post you&apos;ve written, plus its hashtags and how it performed.
          PostPilot learns your voice and what gets engagement — so new posts and
          hashtags get better over time.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Paste a LinkedIn post you wrote…"
          className={inputClass}
        />
        <input
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          placeholder="Hashtags used, e.g. #AI #LLM #BuildInPublic"
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            min={0}
            value={likes}
            onChange={(e) => setLikes(e.target.value)}
            placeholder="Likes"
            className={inputClass}
          />
          <input
            type="number"
            min={0}
            value={impressions}
            onChange={(e) => setImpressions(e.target.value)}
            placeholder="Impressions"
            className={inputClass}
          />
        </div>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Image URL (optional)"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={saving || !text.trim()}
          className="rounded-lg bg-linkedin px-5 py-2.5 font-semibold text-white transition hover:bg-linkedin-dark disabled:opacity-60"
        >
          {saving ? "Embedding…" : "Save to memory"}
        </button>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </form>

      <div className="space-y-3">
        <h2 className="font-semibold text-gray-900">
          Stored memories{" "}
          <span className="text-sm font-normal text-gray-400">
            ({memories.length})
          </span>
        </h2>
        {loading && <p className="text-gray-400">Loading…</p>}
        {!loading && memories.length === 0 && (
          <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-400">
            No memories yet. Add a past post to start building your voice.
          </p>
        )}
        {memories.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                  {m.type === "generated" ? "generated" : "past post"}
                </span>
                {typeof m.likes === "number" && (
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-600">
                    ♥ {m.likes}
                  </span>
                )}
                {typeof m.impressions === "number" && (
                  <span className="rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-600">
                    👁 {m.impressions.toLocaleString()}
                  </span>
                )}
              </div>
              <button
                onClick={() => remove(m.id)}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                Delete
              </button>
            </div>
            <div className="flex gap-3">
              {m.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.imageUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded object-cover"
                />
              )}
              <p className="line-clamp-4 whitespace-pre-wrap text-sm text-gray-700">
                {m.text}
              </p>
            </div>
            {m.hashtags && (
              <p className="mt-2 text-xs text-linkedin">{m.hashtags}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
