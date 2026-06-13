import { getSupabase } from "../supabase/client";
import type { BrandProfile, Tone } from "../types";

/** Supabase (brand_profiles table) implementation of the profile store. */

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

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
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
  const { data, error } = await db()
    .from("brand_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Supabase profile load failed: ${error.message}`);
  return data ? toProfile(data as ProfileRow) : null;
}

export async function saveProfile(
  profile: BrandProfile,
  userId = "local"
): Promise<void> {
  const { error } = await db().from("brand_profiles").upsert({
    user_id: userId,
    name: profile.name,
    headline: profile.headline,
    industry: profile.industry,
    interests: profile.interests,
    audience: profile.audience,
    default_tone: profile.defaultTone,
    voice_notes: profile.voiceNotes,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Supabase profile save failed: ${error.message}`);
}

export async function clearProfile(userId = "local"): Promise<void> {
  const { error } = await db()
    .from("brand_profiles")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(`Supabase profile clear failed: ${error.message}`);
}
