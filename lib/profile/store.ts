import type { BrandProfile, Tone } from "../types";

/**
 * Brand profile persistence (Phase 2).
 *
 * Two backends behind one async interface:
 *   • Supabase (brand_profiles) via /api/profile — used when the server reports
 *     Supabase is configured.
 *   • localStorage — the zero-setup fallback (per browser).
 *
 * The server's configured-flag is probed once and cached.
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

// --- localStorage backend ---

function loadLocal(): BrandProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<BrandProfile>) };
  } catch {
    return null;
  }
}

function saveLocal(profile: BrandProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

function clearLocal(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

// --- server backend detection (cached) ---

let serverMode: boolean | null = null;

async function useServer(): Promise<boolean> {
  if (serverMode !== null) return serverMode;
  try {
    const res = await fetch("/api/profile");
    const data = await res.json();
    serverMode = Boolean(data.configured);
    return serverMode;
  } catch {
    serverMode = false;
    return false;
  }
}

// --- public async API ---

export async function loadProfile(): Promise<BrandProfile | null> {
  try {
    const res = await fetch("/api/profile");
    const data = await res.json();
    if (data.configured) {
      serverMode = true;
      return data.profile
        ? { ...EMPTY_PROFILE, ...(data.profile as Partial<BrandProfile>) }
        : null;
    }
    serverMode = false;
  } catch {
    /* fall through to local */
  }
  return loadLocal();
}

export async function saveProfile(profile: BrandProfile): Promise<void> {
  if (await useServer()) {
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      return;
    } catch {
      /* fall through to local */
    }
  }
  saveLocal(profile);
}

export async function clearProfile(): Promise<void> {
  if (await useServer()) {
    try {
      await fetch("/api/profile", { method: "DELETE" });
      return;
    } catch {
      /* fall through to local */
    }
  }
  clearLocal();
}

/** True if the profile has enough filled in to meaningfully personalize output. */
export function hasUsefulProfile(p: BrandProfile | null): p is BrandProfile {
  return Boolean(p && (p.industry.trim() || p.voiceNotes.trim() || p.headline.trim()));
}
