import OpenAI from "openai";

/**
 * Text generation via OpenRouter (OpenAI-compatible). One key, many models,
 * routed per task. Embeddings stay on Gemini (see ./gemini.ts) — OpenRouter is
 * chat-only and the vector store is already 768-dim.
 *
 * Tune any model without code changes via env (see below). Browse model IDs at
 * https://openrouter.ai/models.
 */

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.warn(
    "[llm] OPENROUTER_API_KEY is not set. Add it to .env.local to enable generation."
  );
}

// Cheap, capable defaults so a missing env var can never fall back to a costly
// model and drain the balance. gpt-4o-mini ≈ $0.15/$0.60 per 1M tokens.
// Override per task with the MODEL_* vars for higher quality.
const STRONG = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const CHEAP = process.env.OPENROUTER_MODEL_CHEAP || "openai/gpt-4o-mini";

/** Which model each task uses (env-overridable). */
export const Models = {
  writer: process.env.MODEL_WRITER || STRONG,
  hook: process.env.MODEL_HOOK || STRONG,
  topic: process.env.MODEL_TOPIC || STRONG,
  scoring: process.env.MODEL_SCORING || CHEAP,
  hashtag: process.env.MODEL_HASHTAG || CHEAP,
  visual: process.env.MODEL_VISUAL || CHEAP,
  calendar: process.env.MODEL_CALENDAR || CHEAP,
} as const;

// Image-generation model. Default to the fast, cheap flash image model
// (~$0.003/image, ~8s — safe under the 60s limit). Set MODEL_IMAGE to
// google/gemini-3-pro-image for max quality (pricier + ~45s).
export const IMAGE_MODEL = process.env.MODEL_IMAGE || "google/gemini-2.5-flash-image";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is missing. Get one at https://openrouter.ai/keys and add it to .env.local"
    );
  }
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://linkedin-postpilot.vercel.app",
        "X-Title": "LinkedIn PostPilot",
      },
    });
  }
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function statusOf(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status?: unknown }).status;
    if (typeof s === "number") return s;
  }
  return undefined;
}

function isTransient(err: unknown): boolean {
  const s = statusOf(err);
  return s === 429 || s === 408 || (s !== undefined && s >= 500);
}

/** Core chat call with exponential-backoff retry on transient errors. */
async function chat(
  prompt: string,
  system: string | undefined,
  model: string
): Promise<string> {
  const ai = getClient();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await ai.chat.completions.create({ model, messages });
      return (res.choices[0]?.message?.content ?? "").trim();
    } catch (err) {
      if (attempt < maxAttempts && isTransient(err)) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

/**
 * Generate an image via an OpenRouter image model. Returns a data: URL
 * (base64 PNG). Uses raw fetch because OpenRouter's image output format
 * (message.images[].image_url.url) isn't in the OpenAI SDK types.
 */
export async function generateImage(
  prompt: string,
  model: string = IMAGE_MODEL
): Promise<string> {
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "LinkedIn PostPilot",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (res.ok) {
      const json = await res.json();
      const url: string | undefined =
        json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (url) return url;
      throw new Error("The image model returned no image.");
    }

    if (attempt < maxAttempts && (res.status === 429 || res.status >= 500)) {
      await sleep(800 * 2 ** (attempt - 1));
      continue;
    }
    const body = await res.text().catch(() => "");
    const err = new Error(`Image generation failed (${res.status}): ${body.slice(0, 200)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  throw new Error("unreachable");
}

/** Generate plain text. */
export async function generateText(
  prompt: string,
  systemInstruction?: string,
  model: string = STRONG
): Promise<string> {
  return chat(prompt, systemInstruction, model);
}

function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

/**
 * Generate JSON. Prompts already specify the exact shape; we parse defensively
 * and retry once if the model slips in prose around the JSON.
 */
export async function generateJSON<T>(
  prompt: string,
  systemInstruction?: string,
  model: string = STRONG
): Promise<T> {
  const sys = `${systemInstruction ? systemInstruction + "\n\n" : ""}Respond with ONLY valid JSON — no markdown fences, no commentary.`;
  let lastRaw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    lastRaw = await chat(prompt, sys, model);
    try {
      return parseJSON<T>(lastRaw);
    } catch {
      // retry once
    }
  }
  throw new Error(`Failed to parse model JSON output: ${lastRaw.slice(0, 500)}`);
}

/** Map a raw AI/SDK error to a clean, user-facing message + HTTP status. */
export function describeAiError(err: unknown): { message: string; status: number } {
  const status = statusOf(err);
  const raw = err instanceof Error ? err.message : String(err);
  if (status === 402 || /insufficient|credit|quota|billing/i.test(raw)) {
    return {
      message: "AI credits are exhausted. Top up your OpenRouter balance and try again.",
      status: 402,
    };
  }
  if (status === 429) {
    return {
      message: "The AI is busy right now. Please try again in a few seconds.",
      status: 429,
    };
  }
  if (status === 401 || /api key|unauthor/i.test(raw)) {
    return { message: "AI is not configured (check OPENROUTER_API_KEY).", status: 500 };
  }
  return { message: "Generation failed. Please try again.", status: 500 };
}
