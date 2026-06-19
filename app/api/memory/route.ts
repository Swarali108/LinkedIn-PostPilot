import { NextRequest, NextResponse } from "next/server";
import {
  addMemory,
  clearMemories,
  deleteMemory,
  listMemories,
} from "@/lib/memory/store";
import { describeAiError } from "@/lib/ai/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET /api/memory?userId=local — list stored memories
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") || "local";
  try {
    const memories = await listMemories(userId);
    return NextResponse.json({ memories });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list memories." },
      { status: 500 }
    );
  }
}

// POST /api/memory — add a past post: { text, userId? }
export async function POST(req: NextRequest) {
  let body: {
    text?: string;
    userId?: string;
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
    const record = await addMemory(body.text, "past-post", body.userId || "local", {
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

// DELETE /api/memory?id=xyz  or  /api/memory?userId=local&all=true
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const all = req.nextUrl.searchParams.get("all");
  const userId = req.nextUrl.searchParams.get("userId") || "local";
  try {
    if (all === "true") {
      await clearMemories(userId);
    } else if (id) {
      await deleteMemory(id);
    } else {
      return NextResponse.json(
        { error: "Provide ?id= or ?all=true." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete." },
      { status: 500 }
    );
  }
}
