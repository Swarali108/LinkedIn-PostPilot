import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "./rate-limit";
import { currentUserId } from "./user-context";

/**
 * Per-endpoint abuse protection for the public AI routes. Keeps a $1 OpenRouter
 * balance from being drained by spam and stops any single caller from hammering
 * an expensive endpoint. Keyed by session user when signed in, else client IP.
 *
 * NOTE: the underlying limiter is in-memory (per serverless instance), so it's a
 * strong first line but not a distributed guarantee. The hard ceiling is the
 * OpenRouter balance itself — keep auto-top-up OFF so spend can never exceed it.
 */

export interface RateWindow {
  limit: number;
  windowMs: number;
}

const MIN = 60_000;

/** Tuned so normal use is never blocked, but scripted abuse is throttled fast. */
export const LIMITS: Record<"text" | "generate" | "image", RateWindow[]> = {
  // Light text endpoints (topics, evaluate, hashtags…).
  text: [
    { limit: 15, windowMs: MIN },
    { limit: 80, windowMs: 15 * MIN },
  ],
  // Heavy multi-model pipelines (generate, rewrite, calendar).
  generate: [
    { limit: 8, windowMs: MIN },
    { limit: 40, windowMs: 15 * MIN },
  ],
  // Image generation — the priciest call.
  image: [
    { limit: 6, windowMs: MIN },
    { limit: 25, windowMs: 60 * MIN },
  ],
};

async function identity(req: NextRequest): Promise<string> {
  try {
    const uid = await currentUserId();
    if (uid) return `u:${uid}`;
  } catch {
    /* fall through to IP */
  }
  return `ip:${clientIp(req.headers)}`;
}

/**
 * Returns a 429 response if the caller has exceeded any window for `name`, else
 * null. Call at the top of a route: `const l = await guard(req, "topics", LIMITS.text); if (l) return l;`
 */
export async function guard(
  req: NextRequest,
  name: string,
  windows: RateWindow[]
): Promise<NextResponse | null> {
  const id = await identity(req);
  for (const w of windows) {
    if (!rateLimit(`${name}|${w.windowMs}|${id}`, w.limit, w.windowMs)) {
      return NextResponse.json(
        { error: "Too many requests — please slow down and try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(w.windowMs / 1000)) } }
      );
    }
  }
  return null;
}

/** Defensively trim a string field so oversized input can't inflate token cost. */
export function cap(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
