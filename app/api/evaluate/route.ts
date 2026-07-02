import { NextRequest, NextResponse } from "next/server";
import { evaluatePost } from "@/lib/ai/evaluator";
import { describeAiError } from "@/lib/ai/llm";
import { guard, cap, LIMITS } from "@/lib/api-guard";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const limited = await guard(req, "evaluate", LIMITS.text);
  if (limited) return limited;

  let body: { post?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.post?.trim()) {
    return NextResponse.json(
      { error: "Missing required field: post." },
      { status: 400 }
    );
  }

  try {
    const evaluation = await evaluatePost(cap(body.post, 8000));
    return NextResponse.json(evaluation);
  } catch (err) {
    const { message, status } = describeAiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
