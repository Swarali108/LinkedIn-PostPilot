import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/profile/db-store";
import { currentUserId } from "@/lib/user-context";
import type { BrandProfile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Server-backed brand profile. The partition key is the AUTHENTICATED user's id
 * (from the session) — never client input. Guests (no session) get 401 and use
 * client-side session storage instead.
 */
const UNAUTH = NextResponse.json({ error: "Unauthorized." }, { status: 401 });
const fail = () =>
  NextResponse.json({ error: "Request failed." }, { status: 500 });

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return UNAUTH;
  try {
    const profile = await store.loadProfile(userId);
    return NextResponse.json({ profile });
  } catch {
    return fail();
  }
}

export async function PUT(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return UNAUTH;
  let body: { profile?: BrandProfile };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.profile) {
    return NextResponse.json({ error: "Missing field: profile." }, { status: 400 });
  }
  try {
    await store.saveProfile(body.profile, userId);
    return NextResponse.json({ ok: true });
  } catch {
    return fail();
  }
}

export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) return UNAUTH;
  try {
    await store.clearProfile(userId);
    return NextResponse.json({ ok: true });
  } catch {
    return fail();
  }
}
