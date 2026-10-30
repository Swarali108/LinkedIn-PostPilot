import { NextRequest, NextResponse } from "next/server";
import {
  addMemory,
  clearMemories,
  deleteMemory,
  listMemories,
} from "@/lib/memory/store";
import { describeAiError } from "@/lib/ai/llm";
import { currentUserId } from "@/lib/user-context";

export const runtime = "nodejs";
export const maxDuration = 30;

const UNAUTH = NextResponse.json(
  { error: "Log in to use brand memory." },
  { status: 401 }
);

// GET /api/memory — list the signed-in user's stored memories
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return UNAUTH;
  try {
    const memories = await listMemories(userId);
    return NextResponse.json({ memories });
  } catch {
    return NextResponse.json({ error: "Request failed." }, { status: 500 });
  }
}

// POST /api/memory — add a past post (scoped to the signed-in user)
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return UNAUTH;
  let body: {
    text?: string;
    hashtags?: string;
    likes?: number;
    impressions?: number;
    imageUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.text?.trim()) {
    return NextResponse.json(
      { error: "Missing required field: text." },
      { status: 400 }
    );
  }
  try {
    const toNum = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : undefined;
    const record = await addMemory(body.text, "past-post", userId, {
      hashtags: body.hashtags?.trim() || undefined,
      likes: toNum(body.likes),
      impressions: toNum(body.impressions),
      imageUrl: body.imageUrl?.trim() || undefined,
    });
    return NextResponse.json({
      memory: {
        id: record.id,
        text: record.text,
        type: record.type,
        createdAt: record.createdAt,
        hashtags: record.hashtags,
        likes: record.likes,
        impressions: record.impressions,
        imageUrl: record.imageUrl,
        similarity: 1,
      },
    });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/memory?id=xyz  or  /api/memory?all=true
export async function DELETE(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return UNAUTH;
  const id = req.nextUrl.searchParams.get("id");
  const all = req.nextUrl.searchParams.get("all");
  try {
    if (all === "true") {
      await clearMemories(userId);
    } else if (id) {
      await deleteMemory(id, userId);
    } else {
      return NextResponse.json(
        { error: "Provide ?id= or ?all=true." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Request failed." }, { status: 500 });
  }
}
