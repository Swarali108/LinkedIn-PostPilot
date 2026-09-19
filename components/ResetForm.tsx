"use client";

import { useEffect, useState } from "react";
import {
  isUsernameTaken,
  requestPasswordReset,
  setNewPassword,
  updateUsername,
} from "@/lib/auth-client";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Password recovery, gated on proof of email ownership.
 *
 * Arriving here with a valid recovery session (via the emailed link → /auth/confirm)
 * shows the new-password form — no email field, because the session already proves
 * who you are. Arriving without one shows only "send me a link": an unauthenticated
 * visitor can never change an account, so knowing someone's email is not enough to
 * take it over.
 */
type Stage = "checking" | "ready" | "needs-link";

export default function ResetForm() {
  const [stage, setStage] = useState<Stage>("checking");

  // "needs-link" state
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  // "ready" state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // A recovery session is set by /auth/confirm before we land here. Supabase may
  // also finish processing a token slightly after mount, so we listen too.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setStage(data.user ? "ready" : "needs-link");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (session?.user && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setStage("ready");
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link.");
    } finally {
      setLoading(false);
    }
  }

  async function applyReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const uname = username.trim().toLowerCase();
      // Check availability first — otherwise a taken username would leave the
      // password already changed and the reset half-applied.
      if (uname) {
        if (!/^[a-z0-9_.-]{3,30}$/.test(uname)) {
          throw new Error("Username must be 3–30 chars (letters, numbers, _ . -).");
        }
        if (await isUsernameTaken(uname)) {
          throw new Error("That username is already taken.");
        }
      }

      await setNewPassword(password);
      if (uname) await updateUsername(uname);

      // End the recovery session so the new password is actually used to get back in.
      await createBrowserSupabase().auth.signOut();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setLoading(false);
    }
  }

  const input =
    "w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-linkedin focus:outline-none focus:ring-1 focus:ring-linkedin";

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-4 rounded-3xl border border-gray-200 bg-white p-8 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linkedin text-lg font-bold text-white">
            P
          </span>
          <span className="text-lg font-bold text-gray-900">PostPilot</span>
        </div>

        {stage === "checking" && (
          <p className="py-4 text-center text-sm text-gray-400">Checking your link…</p>
        )}

        {stage === "needs-link" && (
          <>
            <h1 className="text-xl font-semibold text-gray-900">Reset your password</h1>
            {sent ? (
              <>
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  If an account exists for that email, a reset link is on its way.
                  Open it to choose a new password.
                </p>
                <p className="text-xs text-gray-400">
                  The link expires shortly and can only be used once.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  Enter your account email and we&apos;ll send you a reset link. For
                  your security, a password can only be changed from that link.
                </p>
                <form onSubmit={sendLink} className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your account email"
                    autoFocus
                    className={input}
                  />
                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full rounded-xl bg-linkedin px-4 py-2.5 font-semibold text-white transition hover:bg-linkedin-dark disabled:opacity-60"
                  >
                    {loading ? "Sending…" : "Send reset link"}
                  </button>
                </form>
              </>
            )}
          </>
        )}

        {stage === "ready" && !done && (
          <>
            <h1 className="text-xl font-semibold text-gray-900">Choose a new password</h1>
            <p className="text-sm text-gray-500">
              Your email is verified. Set a new password — your saved posts &amp;
              memory stay intact.
            </p>
            <form onSubmit={applyReset} className="space-y-3">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="New username (optional)"
                className={input}
              />
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  autoFocus
                  className={`${input} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? "🙈" : "👁"}
                </button>
              </div>
              <button
                type="submit"
                disabled={loading || password.length < 6}
                className="w-full rounded-xl bg-linkedin px-4 py-2.5 font-semibold text-white transition hover:bg-linkedin-dark disabled:opacity-60"
              >
                {loading ? "Updating…" : "Save new password"}
              </button>
            </form>
          </>
        )}

        {done && (
          <>
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Updated! Your posts &amp; memory are intact — log in with your new
              details.
            </p>
            <a
              href="/login"
              className="block rounded-xl bg-linkedin px-4 py-2.5 text-center font-semibold text-white hover:bg-linkedin-dark"
            >
              Go to log in →
            </a>
          </>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        {!done && (
          <a
            href="/login"
            className="block text-center text-xs text-gray-400 hover:text-linkedin"
          >
            ← Back to log in
          </a>
        )}
      </div>
    </main>
  );
}
