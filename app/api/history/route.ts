import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/history/db-store";
import { currentUserId } from "@/lib/user-context";
import type { PostType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Server-backed generation history, scoped to the authenticated user. */
const UNAUTH = NextResponse.json({ error: "Unauthorized." }, { status: 401 });
const fail = () => NextResponse.json({ error: "Request failed." }, { status: 500 });

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return UNAUTH;
  try {
    return NextResponse.json({ entries: await store.listHistory(userId) });
  } catch {
    return fail();
  }
}

export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return UNAUTH;
  let body: { topic?: string; postType?: PostType; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.topic || !body.postType || !body.body) {
    return NextResponse.json(
      { error: "Missing fields: topic, postType, body." },
      { status: 400 }
    );
  }
  try {
    const entry = await store.addHistory(
      { topic: body.topic, postType: body.postType, body: body.body },
      userId
    );
    return NextResponse.json({ entry });
  } catch {
    return fail();
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return UNAUTH;
  let body: { id?: string; score?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.id || typeof body.score !== "number") {
    return NextResponse.json({ error: "Missing fields: id, score." }, { status: 400 });
  }
  try {
    await store.setHistoryScore(body.id, body.score, userId);
    return NextResponse.json({ ok: true });
  } catch {
    return fail();
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return UNAUTH;
  const id = req.nextUrl.searchParams.get("id");
  const all = req.nextUrl.searchParams.get("all");
  try {
    if (all === "true") await store.clearHistory(userId);
    else if (id) await store.deleteHistory(id, userId);
    else return NextResponse.json({ error: "Provide ?id= or ?all=true." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return fail();
  }
}
