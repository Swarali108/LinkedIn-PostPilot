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
 * shows the username + new-password form — no email field, because the session
 * already proves who you are, and the account it updates is the one the link was
 * sent to. Arriving without a session shows only "send me a link": an
 * unauthenticated visitor can never change an account, so knowing someone's email
 * is not enough to take it over.
 */
type Stage = "checking" | "ready" | "needs-link";

export default function ResetForm() {
  const [stage, setStage] = useState<Stage>("checking");

  // "needs-link" state
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  // "ready" state
  const [accountEmail, setAccountEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Flag a spent/expired link, from either the query string (our own redirect)
  // or the URL hash (Supabase reports failures there).
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (qs.get("error") || hash.get("error")) setLinkExpired(true);
  }, []);

  // A recovery session is set by /auth/confirm before we land here. Supabase may
  // also finish processing a token slightly after mount, so we listen too.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    let cancelled = false;

    async function adopt(userId: string, mail: string) {
      setAccountEmail(mail);
      // Prefill the current username so it's clear what's being changed.
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", userId)
        .maybeSingle();
      if (!cancelled && data?.username) setUsername(data.username);
      if (!cancelled) setStage("ready");
    }

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (data.user) adopt(data.user.id, data.user.email ?? "");
      else setStage("needs-link");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || !session?.user) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        adopt(session.user.id, session.user.email ?? "");
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
      if (password !== confirm) throw new Error("The two passwords don't match.");

      const uname = username.trim().toLowerCase();
      // Check availability first — otherwise a taken username would leave the
      // password already changed and the reset half-applied.
      if (uname) {
        if (!/^[a-z0-9_.-]{3,30}$/.test(uname)) {
          throw new Error("Username must be 3–30 chars (letters, numbers, _ . -).");
        }
        if (await isUsernameTaken(uname)) {
          // Their own unchanged username also "exists" — only a real clash matters.
          const supabase = createBrowserSupabase();
          const { data: user } = await supabase.auth.getUser();
          const { data: mine } = await supabase
            .from("profiles")
            .select("username")
            .eq("user_id", user.user?.id ?? "")
            .maybeSingle();
          if (mine?.username !== uname) {
            throw new Error("That username is already taken.");
          }
        }
      }

      await setNewPassword(password);
      if (uname) await updateUsername(uname);

      // End the recovery session so the new password is what gets you back in.
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
  const mismatch = confirm.length > 0 && password !== confirm;

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
            {linkExpired && !sent && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
                That link has expired or was already used. Reset links work once —
                enter your email below for a fresh one.
              </p>
            )}
            {sent ? (
              <>
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  If an account exists for that email, a reset link is on its way.
                  Open it to choose a new password.
                </p>
                <p className="text-xs text-gray-400">
                  Open the newest email — each link can only be used once.
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
            <h1 className="text-xl font-semibold text-gray-900">Set your new details</h1>
            <p className="text-sm text-gray-500">
              {accountEmail ? (
                <>
                  Verified as <span className="font-medium text-gray-700">{accountEmail}</span>.
                  Your saved posts &amp; memory stay intact.
                </>
              ) : (
                <>Your email is verified. Your saved posts &amp; memory stay intact.</>
              )}
            </p>
            <form onSubmit={applyReset} className="space-y-3">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
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
              <input
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                aria-invalid={mismatch}
                className={`${input} ${mismatch ? "border-red-400 focus:border-red-400 focus:ring-red-400" : ""}`}
              />
              {mismatch && (
                <p className="text-xs text-red-600">The two passwords don&apos;t match.</p>
              )}
              <button
                type="submit"
                disabled={loading || password.length < 6 || password !== confirm}
                className="w-full rounded-xl bg-linkedin px-4 py-2.5 font-semibold text-white transition hover:bg-linkedin-dark disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save new password"}
              </button>
            </form>
          </>
        )}

        {done && (
          <>
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Saved! Your posts &amp; memory are intact — log in with your new
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
