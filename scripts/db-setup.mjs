// Creates/updates the schema on the database in DATABASE_URL (safe to re-run).
//   npm run db:setup
import { readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (put it in .env.local).");
  process.exit(1);
}

const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf-8");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(schema);
  console.log("Schema applied.");
} finally {
  await client.end();
}
