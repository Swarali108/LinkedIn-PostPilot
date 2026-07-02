import { NextRequest, NextResponse } from "next/server";
import { generateCalendar, type CalendarParams } from "@/lib/ai/calendar-generator";
import { describeAiError } from "@/lib/ai/llm";
import { guard, cap, LIMITS } from "@/lib/api-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = await guard(req, "calendar", LIMITS.generate);
  if (limited) return limited;

  let body: Partial<CalendarParams>;
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

  // Clamp to sane bounds so a bad request can't ask for a 1000-post plan.
  const durationWeeks = Math.min(Math.max(Number(body.durationWeeks) || 1, 1), 4);
  const postsPerWeek = Math.min(Math.max(Number(body.postsPerWeek) || 3, 1), 7);

  try {
    const plan = await generateCalendar({
      industry: cap(body.industry, 200),
      interests: cap(body.interests, 500),
      audience: cap(body.audience, 300),
      brandProfile: body.brandProfile,
      durationWeeks,
      postsPerWeek,
      startDate: body.startDate || new Date().toISOString().slice(0, 10),
    });
    return NextResponse.json(plan);
  } catch (err) {
    const { message, status } = describeAiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
