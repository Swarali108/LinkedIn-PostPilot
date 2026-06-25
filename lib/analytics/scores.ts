import type { BrandProfile, HistoryEntry } from "../types";

/**
 * Derived "brand health" metrics for the dashboard. These are transparent
 * heuristics computed from generation history + brand profile — meaningful
 * signals, not vanity numbers.
 */

export interface BrandScore {
  key: string;
  label: string;
  value: number; // 0-100
  hint: string;
}

const WEEK = 7 * 24 * 60 * 60 * 1000;

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function daysAgo(iso: string): number {
  const t = new Date(iso).getTime();
  return (Date.now() - t) / (24 * 60 * 60 * 1000);
}

export function computeScores(
  entries: HistoryEntry[],
  profile: BrandProfile | null
): BrandScore[] {
  const scored = entries
    .map((e) => e.score)
    .filter((s): s is number => typeof s === "number");
  const avgScore = scored.length
    ? scored.reduce((a, b) => a + b, 0) / scored.length
    : 0;

  // Posting frequency — last 30 days vs a ~3/week target (12/month).
  const last30 = entries.filter((e) => daysAgo(e.createdAt) <= 30).length;
  const frequency = clamp((last30 / 12) * 100);

  // Consistency — how many of the last 4 weeks had at least one post.
  const activeWeeks = new Set<number>();
  for (const e of entries) {
    const age = Date.now() - new Date(e.createdAt).getTime();
    if (age <= 4 * WEEK) activeWeeks.add(Math.floor(age / WEEK));
  }
  const consistency = clamp((activeWeeks.size / 4) * 100);

  // Profile completeness (0-1).
  const fields = profile
    ? [
        profile.name,
        profile.headline,
        profile.industry,
        profile.interests,
        profile.audience,
        profile.voiceNotes,
      ]
    : [];
  const filled = fields.filter((f) => f && f.trim().length > 0).length;
  const completeness = fields.length ? filled / fields.length : 0;

  // Authority — quality of output (avg reach score) with a small volume nudge.
  const authority = clamp(avgScore * 0.85 + Math.min(scored.length, 10) * 1.5);

  // Brand strength — composite of voice definition, consistency & authority.
  const brandStrength = clamp(
    completeness * 100 * 0.4 + consistency * 0.25 + authority * 0.35
  );

  return [
    {
      key: "brand",
      label: "Brand Strength",
      value: brandStrength,
      hint: "Voice + consistency + authority",
    },
    {
      key: "authority",
      label: "Authority",
      value: authority,
      hint: scored.length ? "Avg reach quality of your posts" : "Generate posts to build this",
    },
    {
      key: "consistency",
      label: "Consistency",
      value: consistency,
      hint: `${activeWeeks.size}/4 recent weeks active`,
    },
    {
      key: "frequency",
      label: "Posting Frequency",
      value: frequency,
      hint: `${last30} post${last30 === 1 ? "" : "s"} in the last 30 days`,
    },
  ];
}
