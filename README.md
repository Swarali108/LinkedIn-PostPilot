# LinkedIn PostPilot

An AI-powered personal LinkedIn operating system. Give it a topic and get
scroll-stopping hooks, a complete post, reach-tiered hashtags, and a matching
visual prompt — in under a minute.

> **Status:** Phase 1 — Content Generator MVP (Next.js 15 + Gemini 2.5 Flash).

## Features

**Phase 1 — Content Generator**
- **Hook Generator** — 5 hooks across curiosity / contrarian / story / educational styles.
- **AI Post Writer** — educational, story, opinion, carousel, or personal-insight posts in your chosen tone.
- **Hashtag Engine** — broad / medium / niche reach tiers.
- **Visual Generator** — a ready-to-use AI image prompt for the post.
- **Topic Discovery** — generates topic ideas from your industry/interests.
- **Reach Optimizer** — scores each post 0–100 on hook, readability, authority, virality, CTA, and formatting, with improvement suggestions.

**Phase 2 — Personalization**
- **Brand Profile** — save your name, role, industry, audience, and voice. Every post is written *in your voice*. Stored in your browser (no backend required); signed-in users get it saved to Postgres (Neon).

**Phase 3/4 — Brand Memory + RAG**
- **Brand Memory** — paste past posts; they're embedded with Gemini (`gemini-embedding-001`, 768-dim) and stored in a vector store (Neon Postgres + pgvector, or a local disk fallback).
- **Retrieval-Augmented Generation** — when generating, PostPilot semantically retrieves your most relevant past posts (cosine similarity) and injects them so new posts match your voice. Generated posts can be saved back to memory so the system keeps learning your style.

**Phase 5 — Agentic Workflow**
- **Multi-agent orchestrator** — generation runs as a traced pipeline of named agents (retrieval → hook → writer → hashtag → visual), each reading/patching a shared state. The per-agent trace (status + timing + summary) is returned by `/api/generate` and shown in the UI. See `lib/agents/`.

**Phase 6 — Content Calendar**
- **Content Calendar** — generate a 1–4 week posting plan that rotates 3–4 content pillars and varies post types across the weekdays. Each planned day links straight into the generator.

**Phase 7/8 — Analytics, History & Dashboard**
- **Dashboard** (`/dashboard`) — the hub: stats (posts generated, average & best reach score, memories stored), a tool grid, and recent posts.
- **Post History** (`/post-history`) — every generated post with its reach score; copy or delete. Stored in your browser.

All Gemini calls use schema-constrained JSON output and retry transient 429/503 errors with exponential backoff.

> **Note on persistence:** brand memory is stored at `data/memory.json` (great for local dev). Serverless filesystems are ephemeral, so for production set `DATABASE_URL` to use Neon Postgres + pgvector (see [NEON_SETUP.md](NEON_SETUP.md)).

## Getting started

1. **Get a Gemini API key** (free): https://aistudio.google.com/apikey

2. **Add it to `.env.local`:**

   ```
   GEMINI_API_KEY=your_real_key_here
   GEMINI_MODEL=gemini-2.5-flash-lite
   ```

   > **Model note:** the default `gemini-2.5-flash-lite` has a generous free-tier
   > quota (~1,500 requests/day) and low latency. `gemini-2.5-flash` is higher
   > quality but its free tier is only ~20 requests/day — switch to it if you've
   > enabled billing.

3. **Install & run:**

   ```bash
   npm install
   npm run dev
   ```

4. Open http://localhost:3000 and click **Generate a post**.

## Project structure

```
app/
  page.tsx               Landing page
  post-generator/        The generator UI
  api/generate/          Full pipeline: hooks → post → hashtags + visual
  api/topics/            Topic discovery endpoint
components/posts/
  PostGenerator.tsx      Client form + results
lib/
  types.ts               Shared types
  ai/gemini.ts           Gemini client (text + JSON helpers)
  ai/*-generator.ts      Topic / hook / content / hashtag / visual generators
```

## How generation works

`POST /api/generate` runs the pipeline:

1. Generate hooks for the topic.
2. Write the post body using the top hook as the first line.
3. In parallel, generate hashtags and a visual prompt from the body.

## Roadmap

Future phases (per the design doc): user profiles & personalization (Neon),
brand memory + RAG (ChromaDB embeddings), a multi-agent LangGraph workflow,
content calendar, and analytics/engagement scoring.

## Deployment

Deploy to Vercel and set `GEMINI_API_KEY` in the project's environment variables.
