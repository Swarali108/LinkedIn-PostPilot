import type { HistoryEntry, MemoryMeta } from "../types";

/** A memory record as returned by /api/memory (embedding omitted in payload). */
export type MemoryItem = MemoryMeta & {
  id: string;
  text: string;
  type: string;
  createdAt: string;
};

export type InsightTone = "positive" | "warning" | "neutral";

export interface Insight {
  title: string;
  detail: string;
  tone: InsightTone;
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function titleCase(s: string): string {
  return s.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Derive plain-language, actionable insights from history + brand memory. */
export function computeInsights(
  entries: HistoryEntry[],
  memories: MemoryItem[]
): Insight[] {
  const out: Insight[] = [];
  const scored = entries.filter((e) => typeof e.score === "number");

  if (entries.length === 0) {
    return [
      {
        title: "No data yet",
        detail: "Generate a few posts and your personalized insights will appear here.",
        tone: "neutral",
      },
    ];
  }

  // Best-performing post type by average reach score.
  if (scored.length >= 2) {
    const byType: Record<string, number[]> = {};
    for (const e of scored) (byType[e.postType] ??= []).push(e.score as number);
    const ranked = Object.entries(byType)
      .map(([type, s]) => ({ type, score: avg(s), n: s.length }))
      .sort((a, b) => b.score - a.score);
    if (ranked[0]) {
      out.push({
        title: `${titleCase(ranked[0].type)} posts perform best`,
        detail: `They average a reach score of ${Math.round(
          ranked[0].score
        )}. Lean into this format when you want maximum impact.`,
        tone: "positive",
      });
    }
  }

  // Score trend — recent vs earlier.
  if (scored.length >= 4) {
    const ordered = [...scored].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const half = Math.floor(ordered.length / 2);
    const earlier = avg(ordered.slice(0, half).map((e) => e.score as number));
    const recent = avg(ordered.slice(half).map((e) => e.score as number));
    const delta = Math.round(recent - earlier);
    if (delta >= 3) {
      out.push({
        title: `Your posts are improving (+${delta})`,
        detail: `Recent reach scores are up versus your earlier posts. Keep doing what's working.`,
        tone: "positive",
      });
    } else if (delta <= -3) {
      out.push({
        title: `Reach scores have dipped (${delta})`,
        detail: `Try stronger hooks and a clearer single takeaway per post to recover.`,
        tone: "warning",
      });
    } else {
      out.push({
        title: "Your quality is steady",
        detail: "Reach scores are holding. Experiment with a new hook style to break out.",
        tone: "neutral",
      });
    }
  }

  // Cadence.
  const last30 = entries.filter(
    (e) => Date.now() - new Date(e.createdAt).getTime() <= 30 * 864e5
  ).length;
  out.push({
    title: `${last30} post${last30 === 1 ? "" : "s"} in the last 30 days`,
    detail:
      last30 >= 12
        ? "Excellent cadence — you're posting consistently."
        : `Aim for ~12/month (3 a week). You're ${Math.max(
            0,
            12 - last30
          )} short of a strong rhythm.`,
    tone: last30 >= 12 ? "positive" : "warning",
  });

  // Engagement signal from brand memory, if captured.
  const withLikes = memories.filter((m) => typeof m.likes === "number");
  if (withLikes.length >= 2) {
    const best = [...withLikes].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))[0];
    out.push({
      title: `Your top post earned ${best.likes} likes`,
      detail: `"${best.text.slice(0, 90)}${
        best.text.length > 90 ? "…" : ""
      }" — study why it resonated and repeat the pattern.`,
      tone: "positive",
    });
  }

  // Hashtag insight.
  const tagCounts = countHashtags(memories);
  if (tagCounts.length > 0) {
    out.push({
      title: "Your signature hashtags",
      detail: `You use ${tagCounts
        .slice(0, 3)
        .map((t) => t.tag)
        .join(", ")} most. Consistent tags help LinkedIn categorize your niche.`,
      tone: "neutral",
    });
  }

  return out;
}

export function countHashtags(memories: MemoryItem[]): { tag: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const m of memories) {
    const tags = (m.hashtags || "").match(/#[\w-]+/g) ?? [];
    for (const t of tags) {
      const key = t.toLowerCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export interface EngagementSummary {
  totalLikes: number;
  totalImpressions: number;
  engagementRate: number | null; // likes / impressions %
  withImages: number;
  tracked: number; // memories with any likes/impressions
}

export function summarizeEngagement(memories: MemoryItem[]): EngagementSummary {
  let totalLikes = 0;
  let totalImpressions = 0;
  let tracked = 0;
  let withImages = 0;
  for (const m of memories) {
    if (typeof m.likes === "number" || typeof m.impressions === "number") tracked++;
    totalLikes += m.likes ?? 0;
    totalImpressions += m.impressions ?? 0;
    if (m.imageUrl) withImages++;
  }
  return {
    totalLikes,
    totalImpressions,
    engagementRate: totalImpressions > 0 ? (totalLikes / totalImpressions) * 100 : null,
    withImages,
    tracked,
  };
}
