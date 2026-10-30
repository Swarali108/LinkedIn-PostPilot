"use client";

import { useEffect, useState } from "react";
import {
  applyPasswordReset,
  lookupResetToken,
  requestPasswordReset,
} from "@/lib/auth-client";

/**
 * Password recovery, gated on proof of email ownership.
 *
 * Arriving here with a valid one-time token (the emailed link redirects to
 * /reset?token=…) shows the username + new-password form — no email field,
 * because the token already proves who you are, and the account it updates is
 * the one the link was sent to. Arriving without one shows only "send me a
 * link": an unauthenticated visitor can never change an account, so knowing
 * someone's email is not enough to take it over.
 */
type Stage = "checking" | "ready" | "needs-link";

export default function ResetForm() {
  const [stage, setStage] = useState<Stage>("checking");
  const [token, setToken] = useState("");

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

  // The emailed link redirects here with ?token=… (valid) or ?error=… (spent or
  // expired). Look the token up so we can show which account it's for.
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const t = qs.get("token");
    if (qs.get("error")) setLinkExpired(true);
    if (!t) {
      setStage("needs-link");
      return;
    }
    let cancelled = false;
    lookupResetToken(t).then((acct) => {
      if (cancelled) return;
      if (!acct) {
        setLinkExpired(true);
        setStage("needs-link");
        return;
      }
      setToken(t);
      setAccountEmail(acct.email);
      // Prefill the current username so it's clear what's being changed.
      setUsername(acct.username);
      setStage("ready");
    });
    return () => {
      cancelled = true;
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
      // The server checks the username is free before changing the password, so
      // a clash can't leave the reset half-applied. It also signs out every
      // existing session, so the new password is what gets you back in.
      await applyPasswordReset(token, password, username);
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
