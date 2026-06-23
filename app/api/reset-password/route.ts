import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/client";

export const runtime = "nodejs";

/**
 * Direct password/username reset by email (no email link). Uses the service-role
 * admin API to find the account by email and update it. The account id is
 * unchanged, so the user's data (memory/profile/history) stays intact.
 *
 * SECURITY NOTE: this trusts whoever submits the email — there's no proof of
 * email ownership. Acceptable for a personal/portfolio app; for a real multi-user
 * product, gate this behind an email OTP/link.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const username = body.username?.trim().toLowerCase();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }
  if (username && !/^[a-z0-9_.-]{3,30}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3–30 chars (letters, numbers, _ . -)." },
      { status: 400 }
    );
  }

  const db = getSupabase();
  if (!db) {
    return NextResponse.json(
      { error: "Auth is not configured." },
      { status: 503 }
    );
  }

  try {
    // Find the user by email (admin).
    const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      return NextResponse.json(
        { error: "No account found with that email." },
        { status: 404 }
      );
    }

    // Update the password.
    const { error: pwErr } = await db.auth.admin.updateUserById(user.id, {
      password,
    });
    if (pwErr) throw pwErr;

    // Optionally update the username.
    if (username) {
      const { error: unameErr } = await db
        .from("profiles")
        .update({ username })
        .eq("user_id", user.id);
      if (unameErr) {
        if (unameErr.code === "23505") {
          return NextResponse.json(
            { error: "That username is already taken." },
            { status: 409 }
          );
        }
        throw unameErr;
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Reset failed." }, { status: 500 });
  }
}
