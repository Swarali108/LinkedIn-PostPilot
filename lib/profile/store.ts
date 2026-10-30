import type { BrandProfile, Tone } from "../types";
import { getStorageMode } from "../storage-mode";

/**
 * Brand profile persistence (Phase 2).
 *
 *   - Logged-in users → server (Postgres, scoped to their account).
 *   - Guests → sessionStorage (session-only; cleared when the tab closes).
 */

const STORAGE_KEY = "postpilot.brandProfile";

export const EMPTY_PROFILE: BrandProfile = {
  name: "",
  headline: "",
  industry: "",
  interests: "",
  audience: "",
  defaultTone: "professional" as Tone,
  voiceNotes: "",
};

function loadGuest(): BrandProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<BrandProfile>) } : null;
  } catch {
    return null;
  }
}

export async function loadProfile(): Promise<BrandProfile | null> {
  if ((await getStorageMode()) === "user") {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (res.ok && data.profile) {
        return { ...EMPTY_PROFILE, ...(data.profile as Partial<BrandProfile>) };
      }
      if (res.ok) return null;
    } catch {
      /* fall through */
    }
  }
  return loadGuest();
}

export async function saveProfile(profile: BrandProfile): Promise<void> {
  if ((await getStorageMode()) === "user") {
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      return;
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }
}

export async function clearProfile(): Promise<void> {
  if ((await getStorageMode()) === "user") {
    try {
      await fetch("/api/profile", { method: "DELETE" });
      return;
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== "undefined") window.sessionStorage.removeItem(STORAGE_KEY);
}

/** True if the profile has enough filled in to meaningfully personalize output. */
export function hasUsefulProfile(p: BrandProfile | null): p is BrandProfile {
  return Boolean(p && (p.industry.trim() || p.voiceNotes.trim() || p.headline.trim()));
}
