import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import * as store from "@/lib/history/supabase-store";
import type { PostType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Server-backed generation history (Supabase).
 *
 * When Supabase isn't configured every handler returns { configured: false } so
 * the client store falls back to localStorage. When it is configured, history is
 * persisted in the generation_history table.
 */

function notConfigured() {
  return NextResponse.json({ configured: false });
}

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return notConfigured();
  const userId = req.nextUrl.searchParams.get("userId") || "local";
  try {
    const entries = await store.listHistory(userId);
    return NextResponse.json({ configured: true, entries });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list history." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return notConfigured();
  let body: { topic?: string; postType?: PostType; body?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.topic || !body.postType || !body.body) {
    return NextResponse.json(
      { error: "Missing required fields: topic, postType, body." },
      { status: 400 }
    );
  }
  try {
    const entry = await store.addHistory(
      { topic: body.topic, postType: body.postType, body: body.body },
      body.userId || "local"
    );
    return NextResponse.json({ configured: true, entry });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add history." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!isSupabaseConfigured()) return notConfigured();
  let body: { id?: string; score?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.id || typeof body.score !== "number") {
    return NextResponse.json(
      { error: "Missing required fields: id, score." },
      { status: 400 }
    );
  }
  try {
    await store.setHistoryScore(body.id, body.score);
    return NextResponse.json({ configured: true, ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update score." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseConfigured()) return notConfigured();
  const id = req.nextUrl.searchParams.get("id");
  const all = req.nextUrl.searchParams.get("all");
  const userId = req.nextUrl.searchParams.get("userId") || "local";
  try {
    if (all === "true") await store.clearHistory(userId);
    else if (id) await store.deleteHistory(id);
    else
      return NextResponse.json({ error: "Provide ?id= or ?all=true." }, { status: 400 });
    return NextResponse.json({ configured: true, ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete." },
      { status: 500 }
    );
  }
}
