import { NextRequest, NextResponse } from "next/server";
import { generateImage, describeAiError } from "@/lib/ai/llm";
import { guard, LIMITS } from "@/lib/api-guard";
import type { VisualCard } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Turn a visual-card spec into a rich infographic-design prompt. */
function buildPrompt(card: VisualCard): string {
  const dark = card.theme !== "light";
  const points = (card.points ?? [])
    .map((p, i) => `${i + 1}. ${p.icon ? p.icon + " " : ""}${p.text}`)
    .join("\n");

  return `Create a premium, professional LinkedIn infographic poster. Square 1:1 aspect ratio.

TITLE (large, bold, near the top): "${card.title}"
${card.subtitle ? `SUBTITLE (smaller, under the title): "${card.subtitle}"` : ""}
${
  card.layout === "list" && points
    ? `KEY POINTS — lay these out as clean rows, each with a small modern glowing icon in a rounded badge and a short bold label:\n${points}`
    : ""
}
${card.quote ? `FEATURED QUOTE (large, centered, with quotation marks): "${card.quote}"` : ""}

DESIGN DIRECTION:
- ${dark ? "Dark navy/near-black background (#0b1220)" : "Clean light background (#f8fafc)"} with ${card.accent} as the primary accent and glow color.
- Modern, premium tech-brand aesthetic — like a top-tier LinkedIn carousel cover or a polished SaaS infographic.
- Clean sans-serif typography, CRISP and perfectly legible. All text spelled correctly. No gibberish, no lorem ipsum, no random characters.
- Minimalist line/3D icons, subtle gradients, soft glows, generous spacing, strong visual hierarchy, high contrast.
- A small "PostPilot" wordmark in a bottom corner.
- No watermark. No stock-photo people. Vector/illustration style.

Make it look hand-designed and scroll-stopping.`;
}

export async function POST(req: NextRequest) {
  const limited = await guard(req, "visual-ai", LIMITS.image);
  if (limited) return limited;

  let body: { visual?: VisualCard };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.visual?.title) {
    return NextResponse.json({ error: "Missing visual spec." }, { status: 400 });
  }

  // Bound the card so a crafted spec can't balloon the image prompt.
  const v = body.visual;
  const card: VisualCard = {
    ...v,
    title: String(v.title).slice(0, 120),
    subtitle: v.subtitle ? String(v.subtitle).slice(0, 160) : v.subtitle,
    quote: v.quote ? String(v.quote).slice(0, 280) : v.quote,
    points: Array.isArray(v.points)
      ? v.points.slice(0, 8).map((p) => ({ ...p, text: String(p.text).slice(0, 120) }))
      : v.points,
  };

  try {
    const image = await generateImage(buildPrompt(card));
    return NextResponse.json({ image });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
