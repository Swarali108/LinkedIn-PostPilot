import { sql } from "../db";
import type { BrandProfile, Tone } from "../types";

/** Postgres (brand_profiles table) implementation of the profile store. */

interface ProfileRow {
  user_id: string;
  name: string;
  headline: string;
  industry: string;
  interests: string;
  audience: string;
  default_tone: string;
  voice_notes: string;
}

function toProfile(r: ProfileRow): BrandProfile {
  return {
    name: r.name ?? "",
    headline: r.headline ?? "",
    industry: r.industry ?? "",
    interests: r.interests ?? "",
    audience: r.audience ?? "",
    defaultTone: (r.default_tone as Tone) ?? "professional",
    voiceNotes: r.voice_notes ?? "",
  };
}

export async function loadProfile(userId = "local"): Promise<BrandProfile | null> {
  const [row] = await sql<ProfileRow>(`select * from brand_profiles where user_id = $1`, [userId]);
  return row ? toProfile(row) : null;
}

export async function saveProfile(
  profile: BrandProfile,
  userId = "local"
): Promise<void> {
  await sql(
    `insert into brand_profiles
       (user_id, name, headline, industry, interests, audience, default_tone, voice_notes, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now())
     on conflict (user_id) do update set
       name = excluded.name,
       headline = excluded.headline,
       industry = excluded.industry,
       interests = excluded.interests,
       audience = excluded.audience,
       default_tone = excluded.default_tone,
       voice_notes = excluded.voice_notes,
       updated_at = now()`,
    [
      userId,
      profile.name,
      profile.headline,
      profile.industry,
      profile.interests,
      profile.audience,
      profile.defaultTone,
      profile.voiceNotes,
    ]
  );
}

export async function clearProfile(userId = "local"): Promise<void> {
  await sql(`delete from brand_profiles where user_id = $1`, [userId]);
}
