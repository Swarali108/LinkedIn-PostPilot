import { NextRequest, NextResponse } from "next/server";
import { generateTopics } from "@/lib/ai/topic-generator";
import { describeAiError } from "@/lib/ai/llm";
import { guard, cap, LIMITS } from "@/lib/api-guard";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const limited = await guard(req, "topics", LIMITS.text);
  if (limited) return limited;

  let body: { industry?: string; interests?: string; audience?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.industry?.trim()) {
    return NextResponse.json(
      { error: "Missing required field: industry." },
      { status: 400 }
    );
  }

  try {
    const topics = await generateTopics({
      industry: cap(body.industry, 200),
      interests: cap(body.interests, 500),
      audience: cap(body.audience, 300),
    });
    return NextResponse.json({ topics });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
