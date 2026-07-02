import { NextRequest, NextResponse } from "next/server";
import { addMemory } from "@/lib/memory/store";
import { runPipeline } from "@/lib/agents/orchestrator";
import { CONTENT_PIPELINE } from "@/lib/agents/nodes";
import { describeAiError } from "@/lib/ai/llm";
import { currentUserId } from "@/lib/user-context";
import { guard, cap, LIMITS } from "@/lib/api-guard";
import type { AgentState, AgentStep } from "@/lib/agents/types";
import type { GenerationInput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenerateBody extends Partial<GenerationInput> {
  /** When true, retrieve the user's past posts and write in their style (RAG). */
  useMemory?: boolean;
  /** When true, save the generated post back into memory. */
  saveToMemory?: boolean;
  userId?: string;
}

function isValid(input: GenerateBody): input is GenerateBody & GenerationInput {
  return Boolean(
    input.topic?.trim() && input.postType && input.tone && input.goal
  );
}

export async function POST(req: NextRequest) {
  const limited = await guard(req, "generate", LIMITS.generate);
  if (limited) return limited;

  let input: GenerateBody;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isValid(input)) {
    return NextResponse.json(
      { error: "Missing required fields: topic, postType, tone, goal." },
      { status: 400 }
    );
  }

  // Defensively cap free-text so an oversized request can't inflate token cost.
  input.topic = cap(input.topic, 400);
  if (input.context !== undefined) input.context = cap(input.context, 2000);
  if (input.audience !== undefined) input.audience = cap(input.audience, 300);

  // Partition key comes from the session, never the client. Guests (no session)
  // can generate but get no persistent memory (retrieval/save are off).
  const userId = await currentUserId();
  const memoryEnabled = Boolean(userId);

  const initialState: AgentState = {
    input,
    userId: userId ?? "guest",
    useMemory: memoryEnabled && Boolean(input.useMemory),
  };

  try {
    // Run the agent pipeline: retrieval → hook → writer → hashtag → visual.
    const { state, trace } = await runPipeline(CONTENT_PIPELINE, initialState);

    // Optionally remember this post so future generations learn the user's voice.
    if (memoryEnabled && userId && input.saveToMemory && state.body) {
      try {
        await addMemory(state.body, "generated", userId);
      } catch {
        // Saving to memory is best-effort; don't fail the response.
      }
    }

    return NextResponse.json({
      hooks: state.hooks,
      body: state.body,
      hashtags: state.hashtags,
      visual: state.visual,
      memoryUsed: state.memoryUsed ?? [],
      trace,
    });
  } catch (err) {
    const { message, status } = describeAiError(err);
    const trace = (err as Error & { trace?: AgentStep[] }).trace;
    return NextResponse.json({ error: message, trace }, { status });
  }
}
