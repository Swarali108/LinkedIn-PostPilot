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

export interface BrandTip {
  text: string;
  cta: string;
  href: string;
}

/** Actionable, prioritized suggestions to raise the user's Brand Strength. */
export function brandTips(
  entries: HistoryEntry[],
  profile: BrandProfile | null,
  scores: BrandScore[]
): BrandTip[] {
  const by = Object.fromEntries(scores.map((s) => [s.key, s.value])) as Record<
    string,
    number
  >;
  const tips: BrandTip[] = [];

  // Profile completeness has the biggest leverage on Brand Strength.
  const fields = profile
    ? [
        profile.headline,
        profile.industry,
        profile.interests,
        profile.audience,
        profile.voiceNotes,
      ]
    : [];
  const missing = fields.filter((f) => !f || !f.trim()).length;
  if (!profile || missing >= 2) {
    tips.push({
      text: "Complete your Brand Profile — voice, audience and expertise sharpen every post and lift your score the most.",
      cta: "Complete profile",
      href: "/brand-profile",
    });
  }

  if ((by.consistency ?? 0) < 75) {
    tips.push({
      text: "Post at least once a week for the next month — consistency compounds your reach.",
      cta: "Plan a calendar",
      href: "/content-calendar",
    });
  }

  if ((by.frequency ?? 0) < 70) {
    tips.push({
      text: "Aim for ~3 posts/week. Generate one now to build momentum.",
      cta: "Write a post",
      href: "/post-generator",
    });
  }

  if ((by.authority ?? 0) < 75) {
    tips.push({
      text: "Push for higher quality — regenerate hooks and target a reach score above 80.",
      cta: "Improve a post",
      href: "/post-generator",
    });
  }

  // Feed brand memory so RAG can echo your real voice.
  if (entries.length > 0 && entries.length < 5) {
    tips.push({
      text: "Add a few of your best past posts to Brand Memory so new posts sound more like you.",
      cta: "Add memories",
      href: "/brand-memory",
    });
  }

  if (tips.length === 0) {
    tips.push({
      text: "Strong brand! Keep your streak alive with a fresh post this week.",
      cta: "Write a post",
      href: "/post-generator",
    });
  }

  return tips.slice(0, 4);
}
