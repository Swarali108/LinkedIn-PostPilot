import { generateHooks } from "../ai/hook-generator";
import { generatePost } from "../ai/content-generator";
import { generateHashtags } from "../ai/hashtag-generator";
import { generateVisualCard } from "../ai/visual-generator";
import { evaluatePost } from "../ai/evaluator";
import { retrieveContext } from "../rag/retrieve";
import { getProvenHashtags } from "../memory/store";
import type { Agent } from "./types";

/** Agent 0 — RAG: retrieve the user's relevant past posts to imitate their voice. */
export const retrievalAgent: Agent = {
  name: "retrieval",
  shouldRun: (s) => s.useMemory,
  async run(s) {
    const ctx = await retrieveContext(s.input.topic, s.userId);
    return { memoryBlock: ctx.block, memoryUsed: ctx.hits };
  },
  summarize: (p) =>
    `retrieved ${p.memoryUsed?.length ?? 0} past post(s) for style context`,
};

/** Agent 1 — Hook: generate scroll-stopping opening lines. */
export const hookAgent: Agent = {
  name: "hook",
  async run(s) {
    const hooks = await generateHooks(s.input, s.memoryBlock ?? "");
    const selectedHook =
      hooks[0] ?? { text: s.input.topic, style: "educational" as const };
    return { hooks, selectedHook };
  },
  summarize: (p) => `wrote ${p.hooks?.length ?? 0} hooks`,
};

/** Agent 2 — Writer: write the full post using the selected hook + memory. */
export const writerAgent: Agent = {
  name: "writer",
  async run(s) {
    if (!s.selectedHook) throw new Error("no hook available for the writer");
    const body = await generatePost(s.input, s.selectedHook, s.memoryBlock ?? "");
    return { body };
  },
  summarize: (p) => `drafted a ${p.body?.split(/\s+/).length ?? 0}-word post`,
};

/** Agent 3 — Hashtag: reach-tiered hashtags for the finished post. */
export const hashtagAgent: Agent = {
  name: "hashtag",
  async run(s) {
    if (!s.body) throw new Error("no post body for the hashtag agent");
    // Reuse the user's proven (engagement-ranked) hashtags when memory is on.
    const proven = s.useMemory ? await getProvenHashtags(s.userId) : [];
    const hashtags = await generateHashtags(s.body, s.input.topic, proven);
    return { hashtags };
  },
  summarize: (p) =>
    `suggested ${
      (p.hashtags?.broad.length ?? 0) +
      (p.hashtags?.medium.length ?? 0) +
      (p.hashtags?.niche.length ?? 0)
    } hashtags`,
};

/** Agent 4 — Visual: an AI image prompt matching the post. */
export const visualAgent: Agent = {
  name: "visual",
  async run(s) {
    if (!s.body) throw new Error("no post body for the visual agent");
    const visual = await generateVisualCard(
      s.input.topic,
      s.body,
      s.input.brandProfile
    );
    return { visual };
  },
  summarize: (p) =>
    p.visual ? `designed a "${p.visual.title}" image card` : "no visual",
};

/** Agent 5 — Evaluator: score the post on reach dimensions. */
export const evaluatorAgent: Agent = {
  name: "evaluator",
  async run(s) {
    if (!s.body) throw new Error("no post body for the evaluator");
    const evaluation = await evaluatePost(s.body);
    return { evaluation };
  },
  summarize: (p) => `reach score ${p.evaluation?.overall ?? "?"}/100`,
};

/** The default content-generation pipeline (evaluation runs separately/in the UI). */
export const CONTENT_PIPELINE: Agent[] = [
  retrievalAgent,
  hookAgent,
  writerAgent,
  hashtagAgent,
  visualAgent,
];
