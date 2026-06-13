# Supabase Setup (optional)

PostPilot runs with **zero backend** by default — brand memory lives in a local
JSON file (`data/memory.json`) and profile/history live in your browser.

Enabling Supabase moves **brand memory into Postgres + pgvector**, which is
required for the vector store to persist on serverless hosts like Vercel (their
filesystem is ephemeral). It's fully optional and the app auto-detects it: if the
env vars below are set, it uses Supabase; otherwise it falls back to local disk.

## 1. Create a project

1. Go to https://supabase.com and create a free project.
2. Wait for it to finish provisioning.

## 2. Run the schema

1. In the dashboard, open **SQL Editor → New query**.
2. Paste the contents of [`supabase/schema/schema.sql`](supabase/schema/schema.sql) and **Run**.

This enables the `vector` extension and creates the `memories` table (with a
384-dim embedding column + ivfflat index), the `match_memories` similarity-search
function, and the `brand_profiles`, `generation_history`, and `content_calendars`
tables.

## 3. Add credentials

In the dashboard: **Project Settings → API**. Copy:

- **Project URL** → `SUPABASE_URL`
- **service_role** secret (under "Project API keys") → `SUPABASE_SERVICE_ROLE_KEY`

Add them to `.env.local`:

```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...   # service_role, NOT anon
```

> ⚠️ The `service_role` key bypasses row-level security. It's only ever used in
> server-side API routes here — never ship it to the browser.

## 4. Restart & verify

```bash
npm run dev
```

Add a past post on the **Brand Memory** page. It will now be stored in Supabase —
check **Table Editor → memories** to confirm the row (and its embedding). Generating
with "write in my voice" on will retrieve via the `match_memories` pgvector RPC.

## Architecture note

Embeddings are still computed locally with `all-MiniLM-L6-v2` (no API cost) in
both modes — only storage and similarity search move to Postgres. The store
interface (`lib/memory/store.ts`) dispatches between the disk and Supabase
backends, so nothing else in the app changes.

**Brand memory**, **brand profile**, and **generation history** are all
Supabase-backed when configured (via `/api/memory`, `/api/profile`, `/api/history`),
falling back to the local disk/localStorage stores otherwise. The client stores
probe a `{ configured }` flag from the API and cache it, so no-Supabase mode pays
no extra round-trips. `content_calendars` is created and ready for the same pattern.
