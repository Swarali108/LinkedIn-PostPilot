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

const NETWORK_ERROR = "Can't reach the server. Check your connection and try again.";

type AuthErrorShape = { code?: string; message?: string; status?: number };

/** A user-facing message for an auth API error. Never echoes raw server
 * internals — 5xx responses get a generic line with the status code. */
function authError(error: AuthErrorShape): Error {
  switch (error.code) {
    case "USERNAME_IS_ALREADY_TAKEN":
      return new Error("That username is already taken.");
    case "INVALID_USERNAME_OR_PASSWORD":
      return new Error("Wrong username or password.");
    case "EMAIL_NOT_VERIFIED":
      return new Error(
        "Confirm your email first — we've re-sent the confirmation link to your inbox."
      );
    case "PASSWORD_TOO_SHORT":
      return new Error("Password must be at least 6 characters.");
    case "PASSWORD_TOO_LONG":
      return new Error("That password is too long.");
    case "INVALID_EMAIL":
      return new Error("Enter a valid email address.");
    case "INVALID_USERNAME":
    case "USERNAME_TOO_SHORT":
    case "USERNAME_TOO_LONG":
      return new Error("Username must be 3–30 chars (letters, numbers, _ . -).");
    case "EMAIL_SEND_FAILED":
      return new Error("We couldn't send the email right now. Please try again in a few minutes.");
  }
  const status = error.status ?? 0;
  if (status === 0) return new Error(NETWORK_ERROR);
  if (status === 429) return new Error("Too many attempts. Please wait a minute and try again.");
  if (status >= 500) {
    return new Error(`The server ran into a problem (HTTP ${status}). Please try again shortly.`);
  }
  return new Error(error.message || `Request failed (HTTP ${status}). Please try again.`);
}

/** Run an auth client call; turn thrown network failures and returned API
 * errors into user-facing Errors. */
async function run<T>(
  call: () => Promise<{ data: T; error: AuthErrorShape | null }>
): Promise<T> {
  let result: { data: T; error: AuthErrorShape | null };
  try {
    result = await call();
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  if (result.error) throw authError(result.error);
  return result.data;
}

export async function signUp(
  username: string,
  email: string,
  password: string
): Promise<{ needsConfirm: boolean }> {
  const uname = normalizeUsername(username);
  const data = await run(() =>
    authClient.signUp.email({
      email: email.trim(),
      password,
      name: uname,
      username: uname,
      // Where the confirmation link lands once verified.
      callbackURL: "/dashboard",
    })
  );
  // Email confirmation is required, so there's no session yet.
  return { needsConfirm: !data?.token };
}

export async function signIn(username: string, password: string): Promise<void> {
  await run(() =>
    authClient.signIn.username({
      username: username.trim().toLowerCase(),
      password,
    })
  );
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
  await run(() =>
    authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: "/reset",
    })
  );
}

/** Who a reset token belongs to, or null if it's invalid/expired/spent. Throws
 * on network/server failure, so that isn't mistaken for a spent link. */
export async function lookupResetToken(
  token: string
): Promise<{ email: string; username: string } | null> {
  let res: Response;
  try {
    res = await fetch(`/api/reset?token=${encodeURIComponent(token)}`);
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  if (res.status === 400) return null;
  if (!res.ok) throw authError({ status: res.status });
  return (await res.json()) as { email: string; username: string };
}

/** Step 2: set a new password (and optionally a new username) with the token. */
export async function applyPasswordReset(
  token: string,
  password: string,
  username: string
): Promise<void> {
  const uname = username.trim() ? normalizeUsername(username) : "";
  let res: Response;
  try {
    res = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, username: uname }),
    });
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  if (!res.ok) {
    // 4xx carry a user-facing message from our own route; 5xx get the generic line.
    const data = await res.json().catch(() => ({}));
    throw res.status < 500 && data.error
      ? new Error(data.error)
      : authError({ status: res.status });
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
