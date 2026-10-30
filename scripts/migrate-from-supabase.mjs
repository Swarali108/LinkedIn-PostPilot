// One-time copy of users + data from Supabase Postgres into Neon.
//   npm run db:migrate-supabase
//
// Needs in .env.local:
//   SUPABASE_DB_URL  Supabase → Connect → "Session pooler" connection string
//   DATABASE_URL     Neon connection string (run `npm run db:setup` first)
//
// - User ids are kept, so every memory/profile/history row stays attached to
//   its owner.
// - Password hashes are copied as-is (bcrypt); lib/auth.ts verifies them, so
//   nobody has to reset their password.
// - Idempotent: rows that already exist in Neon are skipped, so it's safe to
//   re-run (e.g. a final sync right before switching over).
import { randomUUID } from "node:crypto";
import pg from "pg";

const { SUPABASE_DB_URL, DATABASE_URL } = process.env;
if (!SUPABASE_DB_URL || !DATABASE_URL) {
  console.error("Set both SUPABASE_DB_URL and DATABASE_URL (in .env.local).");
  process.exit(1);
}

const src = new pg.Client({ connectionString: SUPABASE_DB_URL });
const dst = new pg.Client({ connectionString: DATABASE_URL });
await src.connect();
await dst.connect();

async function copy(label, rows, insert) {
  let added = 0;
  for (const row of rows) added += (await insert(row)).rowCount ?? 0;
  console.log(`${label}: ${added} copied, ${rows.length - added} already present`);
}

try {
  await dst.query("begin");

  // --- Users (auth.users + public.profiles → "user" + credential account) ---
  const { rows: users } = await src.query(`
    select u.id::text as id, u.email, u.encrypted_password, u.email_confirmed_at,
           u.created_at, u.updated_at, p.username
      from auth.users u
      left join public.profiles p on p.user_id = u.id
     where u.email is not null`);

  await copy("users", users, (u) =>
    dst.query(
      `insert into "user" (id, name, email, "emailVerified", username, "createdAt", "updatedAt")
       values ($1, $2, $3, $4, $5, $6, $7) on conflict do nothing`,
      [
        u.id,
        u.username ?? u.email.split("@")[0],
        u.email,
        u.email_confirmed_at != null,
        u.username,
        u.created_at,
        u.updated_at ?? u.created_at,
      ]
    )
  );

  const withPassword = users.filter((u) => u.encrypted_password);
  await copy("password logins", withPassword, (u) =>
    dst.query(
      `insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       select $1, $2, 'credential', $2, $3, $4, $4
        where exists (select 1 from "user" where id = $2)
          and not exists (select 1 from account where "userId" = $2 and "providerId" = 'credential')`,
      [randomUUID(), u.id, u.encrypted_password, u.created_at]
    )
  );

  // --- App data ---
  const { rows: memories } = await src.query(
    `select id, user_id, text, type, embedding::text as embedding, hashtags, likes,
            impressions, image_url, created_at from public.memories`
  );
  await copy("memories", memories, (m) =>
    dst.query(
      `insert into memories (id, user_id, text, type, embedding, hashtags, likes, impressions, image_url, created_at)
       values ($1, $2, $3, $4, $5::vector, $6, $7, $8, $9, $10) on conflict do nothing`,
      [m.id, m.user_id, m.text, m.type, m.embedding, m.hashtags, m.likes, m.impressions, m.image_url, m.created_at]
    )
  );

  const { rows: profiles } = await src.query(`select * from public.brand_profiles`);
  await copy("brand profiles", profiles, (p) =>
    dst.query(
      `insert into brand_profiles (user_id, name, headline, industry, interests, audience, default_tone, voice_notes, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict do nothing`,
      [p.user_id, p.name, p.headline, p.industry, p.interests, p.audience, p.default_tone, p.voice_notes, p.updated_at]
    )
  );

  const { rows: history } = await src.query(`select * from public.generation_history`);
  await copy("history", history, (h) =>
    dst.query(
      `insert into generation_history (id, user_id, topic, post_type, body, score, created_at)
       values ($1, $2, $3, $4, $5, $6, $7) on conflict do nothing`,
      [h.id, h.user_id, h.topic, h.post_type, h.body, h.score, h.created_at]
    )
  );

  const { rows: calendars } = await src.query(`select * from public.content_calendars`);
  await copy("calendars", calendars, (c) =>
    dst.query(
      `insert into content_calendars (id, user_id, plan, created_at)
       values ($1, $2, $3, $4) on conflict do nothing`,
      [c.id, c.user_id, JSON.stringify(c.plan), c.created_at]
    )
  );

  await dst.query("commit");
  console.log("Done.");
} catch (err) {
  await dst.query("rollback");
  console.error("Migration failed — nothing was written:", err.message);
  process.exitCode = 1;
} finally {
  await src.end();
  await dst.end();
}
