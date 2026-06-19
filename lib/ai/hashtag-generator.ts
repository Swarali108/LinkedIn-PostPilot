import { Type } from "@google/genai";
import { generateJSON } from "./gemini";
import type { HashtagGroups } from "../types";

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    broad: { type: Type.ARRAY, items: { type: Type.STRING } },
    medium: { type: Type.ARRAY, items: { type: Type.STRING } },
    niche: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["broad", "medium", "niche"],
};

const SYSTEM = `You are a LinkedIn growth expert who knows hashtag reach tiers.
Broad = 500k+ followers, Medium = 50k-500k, Niche = under 50k but highly relevant.
Return clean hashtags in PascalCase or lowercase, each starting with #.`;

export async function generateHashtags(
  postBody: string,
  topic: string,
  provenHashtags: string[] = []
): Promise<HashtagGroups> {
  const provenBlock = provenHashtags.length
    ? `\nThe user has previously had success with these hashtags (ordered by engagement).
Reuse the ones relevant to this post, and fit them into the right reach tier:
${provenHashtags.join(" ")}\n`
    : "";

  const prompt = `Recommend LinkedIn hashtags for this post about "${topic}".

POST:
"""
${postBody.slice(0, 2000)}
"""
${provenBlock}
Return a JSON object with exactly these fields, each an array of hashtag strings (include the #):
- "broad": 3 high-reach hashtags
- "medium": 3 medium-reach hashtags
- "niche": 4 niche, highly-relevant hashtags

Return ONLY the JSON object.`;

  return generateJSON<HashtagGroups>(prompt, SYSTEM, SCHEMA);
}
