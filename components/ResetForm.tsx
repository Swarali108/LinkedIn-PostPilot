"use client";

import { useState } from "react";
import { resetPasswordDirect } from "@/lib/auth-client";

/**
 * Direct reset page. Works regardless of how the user got here (old email link
 * or the "Forgot password?" link) — it just takes email + new password (+ new
 * username) and updates the account in the database. No recovery token needed.
 */
export default function ResetForm() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await resetPasswordDirect(email, password, username);
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
        <h1 className="text-xl font-semibold text-gray-900">Reset your account</h1>

        {done ? (
          <>
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Updated! Your posts &amp; memory are intact — log in with your new
              details.
            </p>
            <a
              href="/"
              className="block rounded-xl bg-linkedin px-4 py-2.5 text-center font-semibold text-white hover:bg-linkedin-dark"
            >
              Go to log in →
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Enter your account email and a new password. Your saved data stays
              intact — your email is the anchor.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your account email"
                autoFocus
                className={input}
              />
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
                disabled={loading || password.length < 6 || !email}
                className="w-full rounded-xl bg-linkedin px-4 py-2.5 font-semibold text-white transition hover:bg-linkedin-dark disabled:opacity-60"
              >
                {loading ? "Updating…" : "Reset password"}
              </button>
              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}
            </form>
            <a
              href="/"
              className="block text-center text-xs text-gray-400 hover:text-linkedin"
            >
              ← Back to log in
            </a>
          </>
        )}
      </div>
    </main>
  );
}
