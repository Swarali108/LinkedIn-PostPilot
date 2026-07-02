import { NextRequest, NextResponse } from "next/server";
import { generatePost } from "@/lib/ai/content-generator";
import { retrieveContext } from "@/lib/rag/retrieve";
import { describeAiError } from "@/lib/ai/llm";
import { currentUserId } from "@/lib/user-context";
import { guard, cap, LIMITS } from "@/lib/api-guard";
import type { GenerationInput, Hook } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RewriteBody extends Partial<GenerationInput> {
  hook?: Hook;
  useMemory?: boolean;
  userId?: string;
}

function isValid(b: RewriteBody): b is RewriteBody & GenerationInput & { hook: Hook } {
  return Boolean(
    b.topic?.trim() && b.postType && b.tone && b.goal && b.hook?.text
  );
}

/**
 * Rewrite just the post body around a different chosen hook — one LLM call,
 * so switching hooks in the UI is cheap. Hashtags and the visual prompt are
 * topic-driven and don't need regenerating.
 */
export async function POST(req: NextRequest) {
  const limited = await guard(req, "rewrite", LIMITS.generate);
  if (limited) return limited;

  let body: RewriteBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isValid(body)) {
    return NextResponse.json(
      { error: "Missing required fields: topic, postType, tone, goal, hook." },
      { status: 400 }
    );
  }

  body.topic = cap(body.topic, 400);
  if (body.context !== undefined) body.context = cap(body.context, 2000);

  try {
    const userId = await currentUserId();
    let memoryBlock = "";
    if (userId && body.useMemory) {
      const ctx = await retrieveContext(body.topic, userId);
      memoryBlock = ctx.block;
    }
    const post = await generatePost(body, body.hook, memoryBlock);
    return NextResponse.json({ body: post });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
