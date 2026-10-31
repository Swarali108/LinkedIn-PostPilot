# Neon Setup

PostPilot stores accounts and data in **Neon Postgres** (with pgvector for brand
memory) and handles login with **Better Auth**: username + password, with emailed
signup confirmation and password reset. In production the site is
**fail-closed**: without a database, nobody can sign in, though guest mode still
works.

## 1. Create the database

1. Create a project at https://console.neon.tech.
2. Go to **Connect**, turn on **Connection pooling**, and copy the connection string.
3. Add it to `.env.local`:
   ```
   DATABASE_URL=postgresql://...-pooler...neon.tech/neondb?sslmode=require
   ```
4. Create the tables. This is safe to re-run after schema changes:
   ```
   npm run db:setup
   ```

## 2. Environment variables

Set them in `.env.local` for local dev, and in Vercel under **Project → Settings →
Environment Variables**. **Redeploy** after any change, because running
deployments keep the values they were built with.

| Variable | Vercel environments | Value |
|---|---|---|
| `DATABASE_URL` | Production + Preview | Neon **pooled** connection string |
| `BETTER_AUTH_SECRET` | Production + Preview | Random 32+ chars, generated as shown in `.env.example`. Never the placeholder |
| `RESEND_API_KEY` | Production + Preview | `re_…` from https://resend.com/api-keys |
| `EMAIL_FROM` | Production + Preview | `PostPilot <noreply@your-verified-domain>` |
| `NEXT_PUBLIC_SITE_URL` | **Production only** | `https://your-prod-domain`, with no trailing slash |

`NEXT_PUBLIC_SITE_URL` is Production-only on purpose. Previews leave it unset,
so they fall back to their own `https://$VERCEL_URL`, and links in their emails
point back at that preview. Locally, set it to `http://localhost:3000`.

On startup the server logs a `[env] ✗ …` line for every required variable that
is missing or still a placeholder. That's the first thing to check in
**Vercel → Logs** if auth misbehaves.

### Resend sender requirements

Resend only delivers from a domain you've proven you own:

1. Go to Resend → **Domains → Add domain**, and add a domain or subdomain you control.
2. Add the DNS records Resend shows (SPF/DKIM) at your DNS provider, and wait
   until the domain shows **Verified**.
3. Set `EMAIL_FROM` to an address on that domain, e.g. `PostPilot <noreply@mail.example.com>`.

Without a verified domain, the only sender allowed is `onboarding@resend.dev`
(used when `EMAIL_FROM` is unset), and it can **only** send to the email address
of your own Resend account. Use it for a quick self-test, never for real users.
When Resend rejects an email, the server log shows its exact reason, e.g.
`[email] Resend rejected the email (HTTP 403 …): The yourdomain.com domain is not verified`.

### Local dev

Leave `RESEND_API_KEY` blank locally. Confirmation and reset emails then get
printed to the `npm run dev` terminal, where you can click the link. On Vercel a
missing key is treated as an error, so emails are never silently dropped.

### What users see if email fails

- **Sign-up:** the account is rolled back and the user sees "We couldn't send the
  email right now", so they can simply retry.
- **Unconfirmed accounts:** if the confirmation email got lost, logging in re-sends
  it, and signing up again with the same email replaces the abandoned attempt.

## 3. Migrating from Supabase (one-time)

1. In Supabase, open **Connect** and copy the **Session pooler** connection string.
   Add it to `.env.local` as `SUPABASE_DB_URL=...`.
2. Run:
   ```
   npm run db:migrate-supabase
   ```
   This copies users (with their existing password hashes, so nobody has to
   reset), usernames, brand memory, profiles, history and calendars. User ids
   don't change, so every row stays with its owner. It runs as a single
   transaction, and you can re-run it to pick up anything new before you switch
   over.
3. Deploy with the new env vars, then remove the old `NEXT_PUBLIC_SUPABASE_*`,
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` vars from Vercel. Once you've
   confirmed everything works, delete `SUPABASE_DB_URL` and pause the Supabase
   project.

Everyone is signed out once, because sessions don't carry over. Users log back
in with the same username and password.

## Test checklist

- Sign up (username + email + password), confirm via the emailed link, and you
  should land on the dashboard signed in.
- Log in by **username** + password. Try a migrated account too.
- "Forgot password": open the emailed link, which goes to `/reset`, set a new
  password and/or username, then log in.
- Brand profile, memory and history persist and are **separate per account**.
- "Use without an account" (guest) works, but the data clears when the tab closes.

---

In local dev the app also runs with **no database** at all. Brand memory falls
back to `data/memory.json`, and profile/history use browser session storage.
Accounts require the database.
