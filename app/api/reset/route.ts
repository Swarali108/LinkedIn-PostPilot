import { NextRequest, NextResponse } from "next/server";
import { auth, USERNAME_RE } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Password reset, step 2. Authorized ONLY by the one-time token from the emailed
 * link (Better Auth stores it in `verification` as `reset-password:<token>`).
 *
 *   GET  ?token=…                      → which account the link is for (prefill)
 *   POST { token, password, username } → set the new password (+ username)
 */

const INVALID = () =>
  NextResponse.json({ error: "This reset link has expired or was already used." }, { status: 400 });

async function accountForToken(
  token: string
): Promise<{ id: string; email: string; username: string | null } | null> {
  const [row] = await sql<{ id: string; email: string; username: string | null }>(
    `select u.id, u.email, u.username
       from verification v
       join "user" u on u.id = v.value
      where v.identifier = $1 and v."expiresAt" > now()
      limit 1`,
    [`reset-password:${token}`]
  );
  return row ?? null;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return INVALID();
  try {
    const acct = await accountForToken(token);
    if (!acct) return INVALID();
    return NextResponse.json({ email: acct.email, username: acct.username ?? "" });
  } catch {
    return NextResponse.json({ error: "Request failed." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string; username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { token, password } = body;
  const uname = (body.username ?? "").trim().toLowerCase();
  if (!token || !password) {
    return NextResponse.json({ error: "Missing fields: token, password." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  if (uname && !USERNAME_RE.test(uname)) {
    return NextResponse.json(
      { error: "Username must be 3–30 chars (letters, numbers, _ . -)." },
      { status: 400 }
    );
  }

  try {
    const acct = await accountForToken(token);
    if (!acct) return INVALID();

    // Check the username BEFORE touching the password, so a clash can't leave the
    // reset half-applied. (Their own unchanged username isn't a clash.)
    if (uname && uname !== acct.username) {
      const [taken] = await sql(`select 1 from "user" where username = $1 and id <> $2`, [
        uname,
        acct.id,
      ]);
      if (taken) {
        return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
      }
    }

    // Consumes the token, re-hashes, and signs out every existing session.
    await auth.api.resetPassword({ body: { newPassword: password, token } });

    if (uname && uname !== acct.username) {
      await sql(`update "user" set username = $1, name = $1, "updatedAt" = now() where id = $2`, [
        uname,
        acct.id,
      ]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { body?: { code?: string } })?.body?.code;
    if (code === "INVALID_TOKEN") return INVALID();
    if ((err as { code?: string })?.code === "23505") {
      return NextResponse.json(
        { error: "Password saved, but that username was just taken — log in and try another." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Reset failed." }, { status: 500 });
  }
}
