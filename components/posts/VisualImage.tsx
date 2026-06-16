"use client";

import { useEffect, useState } from "react";
import type { VisualPrompt } from "@/lib/types";

/**
 * Renders an actual image for the post by feeding the AI-generated prompt to
 * Pollinations.ai — a free, no-key image generator. It's a plain <img> whose
 * URL encodes the prompt, so generation happens in the browser with no backend
 * cost. Falls back to showing the prompt text if the service fails.
 */
export default function VisualImage({ visual }: { visual: VisualPrompt }) {
  const [seed, setSeed] = useState(1);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  // Reset when the prompt changes (new generation).
  useEffect(() => {
    setSeed(1);
    setStatus("loading");
  }, [visual.prompt]);

  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(visual.prompt)}` +
    `?width=1024&height=1024&nologo=true&model=flux&seed=${seed}`;

  function regenerate() {
    setStatus("loading");
    setSeed((s) => s + 1);
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Visual
        </h2>
        <div className="flex items-center gap-3">
          {status === "loaded" && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-linkedin hover:underline"
            >
              Open full size
            </a>
          )}
          <button
            onClick={regenerate}
            disabled={status === "loading"}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-60"
          >
            {status === "loading" ? "Generating…" : "Regenerate"}
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
        {status === "loading" && (
          <div className="flex aspect-square w-full animate-pulse items-center justify-center text-sm text-gray-400">
            Generating image…
          </div>
        )}
        {status === "error" ? (
          <div className="p-4 text-sm text-gray-500">
            Couldn&apos;t generate an image right now. Prompt:
            <p className="mt-1 text-gray-800">{visual.prompt}</p>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={visual.prompt}
            className={`aspect-square w-full object-cover ${status === "loading" ? "hidden" : ""}`}
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
          />
        )}
      </div>

      <p className="mt-2 text-xs text-gray-400">{visual.prompt}</p>
      <p className="mt-1 text-xs text-gray-400">
        {visual.style} · {visual.dimensions} · generated via Pollinations.ai
      </p>
    </section>
  );
}
