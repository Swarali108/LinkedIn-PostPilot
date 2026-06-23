import { createBrowserSupabase } from "./supabase/browser";

/** Client-side auth flows (run in the browser via the anon Supabase client). */

const GUEST_COOKIE = "pp_guest";

/** Stable base URL for email links — uses NEXT_PUBLIC_SITE_URL if set, else the
 * current origin. Set NEXT_PUBLIC_SITE_URL=https://<prod-domain> so reset/confirm
 * links always point at production, regardless of which URL you're on. */
function siteBase(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  const base =
    env || (typeof window !== "undefined" ? window.location.origin : "");
  return base.replace(/\/$/, "");
}

export async function signUp(
  username: string,
  email: string,
  password: string
): Promise<{ needsConfirm: boolean }> {
  const supabase = createBrowserSupabase();
  const uname = username.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,30}$/.test(uname)) {
    throw new Error("Username must be 3–30 chars (letters, numbers, _ . -).");
  }
  const { data: taken } = await supabase.rpc("username_taken", { uname });
  if (taken) throw new Error("That username is already taken.");

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { username: uname },
      emailRedirectTo: `${siteBase()}/login`,
    },
  });
  if (error) throw new Error(error.message);
  // If email confirmation is on, there's no session yet.
  return { needsConfirm: !data.session };
}

export async function signIn(username: string, password: string): Promise<void> {
  const supabase = createBrowserSupabase();
  const { data: email, error: rpcErr } = await supabase.rpc("email_for_username", {
    uname: username.trim().toLowerCase(),
  });
  if (rpcErr) throw new Error(rpcErr.message);
  if (!email) throw new Error("No account with that username.");
  const { error } = await supabase.auth.signInWithPassword({
    email: email as string,
    password,
  });
  if (error) throw new Error(error.message);
  clearGuest();
}

export async function signOut(): Promise<void> {
  const supabase = createBrowserSupabase();
  await supabase.auth.signOut();
  clearGuest();
}

/**
 * Direct reset by email — no email link. Sends the email + new password (+ new
 * username) to the server, which updates the account in the database. The account
 * id never changes, so the user's posts/memory/history stay intact.
 */
export async function resetPasswordDirect(
  email: string,
  password: string,
  username?: string
): Promise<void> {
  const res = await fetch("/api/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password, username }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Reset failed.");
}

export async function setNewPassword(password: string): Promise<void> {
  const supabase = createBrowserSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

/** Change the signed-in user's username (used on the reset page). */
export async function updateUsername(username: string): Promise<void> {
  const supabase = createBrowserSupabase();
  const uname = username.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,30}$/.test(uname)) {
    throw new Error("Username must be 3–30 chars (letters, numbers, _ . -).");
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { error } = await supabase
    .from("profiles")
    .update({ username: uname })
    .eq("user_id", user.id);
  if (error) {
    if (error.code === "23505") throw new Error("That username is already taken.");
    throw new Error(error.message);
  }
}

/** Enter guest mode. Critically, sign out any existing session and clear local
 * data first, so a guest can NEVER see a previously logged-in user's data. */
export async function continueAsGuest(): Promise<void> {
  try {
    await createBrowserSupabase().auth.signOut();
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem("postpilot.brandProfile");
    window.sessionStorage.removeItem("postpilot.history");
  }
  document.cookie = `${GUEST_COOKIE}=1; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
}

export function clearGuest(): void {
  document.cookie = `${GUEST_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** True if the current browser session is in guest mode. */
export function isGuest(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c === `${GUEST_COOKIE}=1`);
}
