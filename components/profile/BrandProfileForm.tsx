"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandProfile, Tone } from "@/lib/types";
import {
  EMPTY_PROFILE,
  clearProfile,
  loadProfile,
  saveProfile,
} from "@/lib/profile/store";

const TONES: { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
  { value: "bold", label: "Bold" },
  { value: "inspirational", label: "Inspirational" },
  { value: "educational", label: "Educational" },
  { value: "witty", label: "Witty" },
];

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-linkedin focus:outline-none focus:ring-1 focus:ring-linkedin";

export default function BrandProfileForm() {
  const router = useRouter();
  const [profile, setProfile] = useState<BrandProfile>(EMPTY_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load any saved profile on mount.
  useEffect(() => {
    loadProfile().then((existing) => {
      if (existing) setProfile(existing);
      setLoaded(true);
    });
  }, []);

  function update<K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await saveProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleReset() {
    await clearProfile();
    setProfile(EMPTY_PROFILE);
    setSaved(false);
  }

  if (!loaded) {
    return <div className="text-gray-400">Loading…</div>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            value={profile.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Jordan Lee"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Headline / role
          </label>
          <input
            value={profile.headline}
            onChange={(e) => update("headline", e.target.value)}
            placeholder="Senior AI Engineer @ Acme"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Industry / field
          </label>
          <input
            value={profile.industry}
            onChange={(e) => update("industry", e.target.value)}
            placeholder="AI engineering"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Default tone
          </label>
          <select
            value={profile.defaultTone}
            onChange={(e) => update("defaultTone", e.target.value as Tone)}
            className={inputClass}
          >
            {TONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Topics / interests
        </label>
        <input
          value={profile.interests}
          onChange={(e) => update("interests", e.target.value)}
          placeholder="RAG, developer experience, career growth"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Target audience
        </label>
        <input
          value={profile.audience}
          onChange={(e) => update("audience", e.target.value)}
          placeholder="Early-career developers and AI engineers"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Voice & writing style
        </label>
        <textarea
          value={profile.voiceNotes}
          onChange={(e) => update("voiceNotes", e.target.value)}
          placeholder="Direct and a little contrarian. Short sentences. I use concrete examples from real projects and avoid buzzwords. Optionally paste a past post here so PostPilot can match your voice."
          rows={5}
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-linkedin px-5 py-2.5 font-semibold text-white transition hover:bg-linkedin-dark"
        >
          {saved ? "Saved ✓" : "Save profile"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/post-generator")}
          className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 transition hover:border-linkedin hover:text-linkedin"
        >
          Generate a post →
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="ml-auto text-sm text-gray-400 hover:text-red-500"
        >
          Clear
        </button>
      </div>

      <p className="text-xs text-gray-400">
        Saved in your browser. Every post you generate will be written in this voice.
      </p>
    </form>
  );
}
