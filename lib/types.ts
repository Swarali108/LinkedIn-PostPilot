// Shared types for LinkedIn PostPilot (Phase 1 — Content Generator MVP)

export type Tone =
  | "professional"
  | "conversational"
  | "bold"
  | "inspirational"
  | "educational"
  | "witty";

export type PostType =
  | "educational"
  | "story"
  | "opinion"
  | "carousel"
  | "personal-insight";

export type Goal =
  | "build-authority"
  | "grow-audience"
  | "drive-engagement"
  | "share-learning"
  | "get-job-opportunities";

/**
 * The user's persistent brand identity. Injected into generation so outputs
 * sound like the specific person, not a generic LinkedIn bot.
 * (Phase 2 — Personalization Layer.)
 */
export interface BrandProfile {
  name: string;
  /** e.g. "Senior Frontend Engineer @ Acme" */
  headline: string;
  industry: string;
  /** Comma-separated topics/interests they post about. */
  interests: string;
  /** Who they're writing for. */
  audience: string;
  /** Default tone for their posts. */
  defaultTone: Tone;
  /** Free-form notes on their voice, plus optional sample of their writing. */
  voiceNotes: string;
}

export interface GenerationInput {
  topic: string;
  postType: PostType;
  tone: Tone;
  goal: Goal;
  audience?: string;
  /** Optional extra context the user wants woven in. */
  context?: string;
  /** Optional brand profile for personalization. */
  brandProfile?: BrandProfile;
}

export interface TopicSuggestion {
  title: string;
  angle: string;
  category: "trending" | "personalized" | "story" | "learning";
}

export interface Hook {
  text: string;
  style: "curiosity" | "contrarian" | "story" | "educational";
}

export interface HashtagGroups {
  broad: string[];
  medium: string[];
  niche: string[];
}

/** A point/row in a list-style visual card. */
export interface VisualCardPoint {
  /** A single emoji or short symbol shown beside the text. */
  icon: string;
  text: string;
}

/**
 * A spec for a designed LinkedIn image card. Rendered to a real PNG (crisp text,
 * on-brand colors) by /api/visual-image — not an AI-generated photo.
 */
export interface VisualCard {
  title: string;
  subtitle?: string;
  layout: "list" | "quote";
  /** For layout="list": 3-7 rows. */
  points?: VisualCardPoint[];
  /** For layout="quote": one punchy line pulled from the post. */
  quote?: string;
  /** Accent color (hex, e.g. "#0a66c2") — the card's vibe. */
  accent: string;
  theme: "dark" | "light";
}

export interface GeneratedPost {
  hooks: Hook[];
  /** The full post body, ready to paste into LinkedIn. */
  body: string;
  hashtags: HashtagGroups;
  visual: VisualCard;
}

export type ScoreDimension =
  | "hook"
  | "readability"
  | "authority"
  | "virality"
  | "cta"
  | "formatting";

export interface DimensionScore {
  dimension: ScoreDimension;
  /** 0-100 */
  score: number;
  reason: string;
}

export interface PostEvaluation {
  /** Weighted overall score, 0-100. */
  overall: number;
  dimensions: DimensionScore[];
  /** Concrete, actionable improvement suggestions. */
  suggestions: string[];
}

// --- Phase 3/4: Brand Memory + RAG ---

export type MemoryType = "past-post" | "generated";

/** Optional engagement + media metadata captured for a past post, used to learn
 * what performs and to inform hashtags/visuals. */
export interface MemoryMeta {
  /** Hashtags the user actually used (free text, e.g. "#AI #LLM"). */
  hashtags?: string;
  likes?: number;
  impressions?: number;
  /** URL of the image the user posted with it. */
  imageUrl?: string;
}

/** A stored piece of the user's writing, with its embedding, for semantic recall. */
export interface MemoryRecord extends MemoryMeta {
  id: string;
  userId: string;
  text: string;
  type: MemoryType;
  embedding: number[];
  createdAt: string;
}

/** A memory returned from search, with its relevance score. Embedding omitted to keep payloads small. */
export interface MemoryHit extends MemoryMeta {
  id: string;
  text: string;
  type: MemoryType;
  createdAt: string;
  /** Cosine similarity to the query, 0-1. */
  similarity: number;
}

// --- Phase 6: Content Calendar ---

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

/** One planned post in the content calendar. */
export interface PlannedPost {
  /** 1-based week within the plan. */
  week: number;
  weekday: Weekday;
  topic: string;
  postType: PostType;
  /** One-line angle/hook idea. */
  angle: string;
  /** Content pillar this post belongs to (e.g. "Career growth"). */
  pillar: string;
  /** Computed actual date (ISO yyyy-mm-dd), filled in after generation. */
  date?: string;
}

export interface CalendarPlan {
  durationWeeks: number;
  postsPerWeek: number;
  /** The content pillars the plan rotates through. */
  pillars: string[];
  posts: PlannedPost[];
}

// --- Phase 7: History & Analytics ---

/** A record of a post the user generated, kept for history + analytics. */
export interface HistoryEntry {
  id: string;
  topic: string;
  postType: PostType;
  body: string;
  /** Overall reach score (0-100) once evaluated; undefined until scoring finishes. */
  score?: number;
  createdAt: string;
}
