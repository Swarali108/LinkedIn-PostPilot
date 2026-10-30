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

## 2. Auth + email env vars

Add these to `.env.local` and to Vercel (Project → Settings → Environment Variables):

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000        # your prod domain on Vercel
BETTER_AUTH_SECRET=...                             # random 32+ bytes, see .env.example
RESEND_API_KEY=re_...                              # https://resend.com/api-keys
EMAIL_FROM=PostPilot <noreply@yourdomain.com>      # domain must be verified in Resend
```

In local dev you can leave `RESEND_API_KEY` blank. Confirmation and reset emails
then get printed to the `npm run dev` terminal, where you can click the link.

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
