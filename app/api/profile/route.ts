import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import * as store from "@/lib/profile/supabase-store";
import type { BrandProfile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Server-backed brand profile (Supabase). Returns { configured: false } when
 * Supabase isn't set up so the client store falls back to localStorage.
 */

function notConfigured() {
  return NextResponse.json({ configured: false });
}

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return notConfigured();
  const userId = req.nextUrl.searchParams.get("userId") || "local";
  try {
    const profile = await store.loadProfile(userId);
    return NextResponse.json({ configured: true, profile });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load profile." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  if (!isSupabaseConfigured()) return notConfigured();
  let body: { profile?: BrandProfile; userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.profile) {
    return NextResponse.json({ error: "Missing required field: profile." }, { status: 400 });
  }
  try {
    await store.saveProfile(body.profile, body.userId || "local");
    return NextResponse.json({ configured: true, ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save profile." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseConfigured()) return notConfigured();
  const userId = req.nextUrl.searchParams.get("userId") || "local";
  try {
    await store.clearProfile(userId);
    return NextResponse.json({ configured: true, ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to clear profile." },
      { status: 500 }
    );
  }
}
