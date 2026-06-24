"use client";

import { useEffect, useMemo, useState } from "react";
import type { VisualCard } from "@/lib/types";

/**
 * Post visual. An instant template-rendered card (/api/visual-image) shows first,
 * then a richer AI-designed infographic is generated automatically in the
 * background (/api/visual-ai) and swapped in when ready. The user can regenerate
 * or fall back to the simple card.
 */

// Unicode-safe base64 (emoji-friendly), matching the route decoder.
function encodeSpec(card: VisualCard): string {
  const bytes = new TextEncoder().encode(JSON.stringify(card));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

export default function VisualImage({ visual }: { visual: VisualCard }) {
  const cardUrl = useMemo(
    () => `/api/visual-image?spec=${encodeURIComponent(encodeSpec(visual))}`,
    [visual]
  );

  const [aiImage, setAiImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useSimple, setUseSimple] = useState(false);

  const shown = aiImage && !useSimple ? aiImage : cardUrl;

  async function runGenerate(signal?: { cancelled: boolean }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/visual-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visual }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Image generation failed.");
      if (!signal?.cancelled) setAiImage(data.image as string);
    } catch (err) {
      if (!signal?.cancelled)
        setError(err instanceof Error ? err.message : "Image generation failed.");
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }

  // Auto-design the image whenever a new post's visual arrives.
  useEffect(() => {
    const signal = { cancelled: false };
    setAiImage(null);
    setUseSimple(false);
    runGenerate(signal);
    return () => {
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visual]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Visual
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setUseSimple(false);
              runGenerate();
            }}
            disabled={loading}
            className="rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Designing…" : "↻ Regenerate"}
          </button>
          <a
            href={shown}
            download="postpilot-visual.png"
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
          >
            Download
          </a>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-gray-100">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm font-medium text-gray-600 backdrop-blur-sm">
            Designing your image…
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shown} alt={visual.title} className="aspect-square w-full object-cover" />
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}
      <p className="mt-2 text-xs text-gray-400">
        {aiImage && !useSimple ? (
          <>
            AI-designed infographic
            <button
              onClick={() => setUseSimple(true)}
              className="ml-2 text-linkedin hover:underline"
            >
              use simple card
            </button>
          </>
        ) : loading ? (
          "Designing a custom infographic…"
        ) : (
          <>
            Template card
            {aiImage && (
              <button
                onClick={() => setUseSimple(false)}
                className="ml-2 text-linkedin hover:underline"
              >
                show AI image
              </button>
            )}
          </>
        )}
      </p>
    </section>
  );
}
