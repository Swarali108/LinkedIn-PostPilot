import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

/** Client-side auth flows (run in the browser against /api/auth). */

export const authClient = createAuthClient({ plugins: [usernameClient()] });

const GUEST_COOKIE = "pp_guest";
const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/;

function normalizeUsername(username: string): string {
  const uname = username.trim().toLowerCase();
  if (!USERNAME_RE.test(uname)) {
    throw new Error("Username must be 3–30 chars (letters, numbers, _ . -).");
  }
  return uname;
}

/** Friendlier wording for the error codes users actually hit. */
function authError(error: { code?: string; message?: string }): Error {
  switch (error.code) {
    case "USERNAME_IS_ALREADY_TAKEN":
      return new Error("That username is already taken.");
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return new Error("An account with that email already exists.");
    case "INVALID_USERNAME_OR_PASSWORD":
      return new Error("Wrong username or password.");
    case "EMAIL_NOT_VERIFIED":
      return new Error("Confirm your email first — we've sent you a fresh link.");
    default:
      return new Error(error.message || "Something went wrong.");
  }
}

export async function signUp(
  username: string,
  email: string,
  password: string
): Promise<{ needsConfirm: boolean }> {
  const uname = normalizeUsername(username);
  const { data, error } = await authClient.signUp.email({
    email: email.trim(),
    password,
    name: uname,
    username: uname,
    // Where the confirmation link lands once verified.
    callbackURL: "/dashboard",
  });
  if (error) throw authError(error);
  // Email confirmation is required, so there's no session yet.
  return { needsConfirm: !data?.token };
}

export async function signIn(username: string, password: string): Promise<void> {
  const { error } = await authClient.signIn.username({
    username: username.trim().toLowerCase(),
    password,
  });
  if (error) throw authError(error);
  clearGuest();
}

export async function signOut(): Promise<void> {
  await authClient.signOut();
  clearGuest();
}

/**
 * Step 1 of password recovery: email the account owner a one-time reset link.
 *
 * SECURITY: proof of email ownership is what authorizes a reset. We never change
 * an account from an unauthenticated request — knowing someone's address must not
 * be enough to take over their account. The link lands on /reset?token=…, and
 * only that token can change the password.
 *
 * Resolves the same way for unknown addresses, so this can't be used to probe
 * which emails have accounts.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await authClient.requestPasswordReset({
    email: email.trim(),
    redirectTo: "/reset",
  });
  if (error) throw authError(error);
}

/** Who a reset token belongs to, or null if it's invalid/expired/spent. */
export async function lookupResetToken(
  token: string
): Promise<{ email: string; username: string } | null> {
  const res = await fetch(`/api/reset?token=${encodeURIComponent(token)}`);
  if (!res.ok) return null;
  return (await res.json()) as { email: string; username: string };
}

/** Step 2: set a new password (and optionally a new username) with the token. */
export async function applyPasswordReset(
  token: string,
  password: string,
  username: string
): Promise<void> {
  const uname = username.trim() ? normalizeUsername(username) : "";
  const res = await fetch("/api/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password, username: uname }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Reset failed.");
  }
}

/** Enter guest mode. Critically, sign out any existing session and clear local
 * data first, so a guest can NEVER see a previously logged-in user's data. */
export async function continueAsGuest(): Promise<void> {
  try {
    await authClient.signOut();
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
