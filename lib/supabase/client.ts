import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client.
 *
 * Uses the service-role key (server-only — never expose to the browser) so API
 * routes can read/write regardless of row-level security. All Supabase access in
 * this app goes through server API routes, so the anon key isn't needed client-side.
 *
 * Supabase is OPTIONAL: when these env vars are absent the app falls back to the
 * local disk/localStorage stores, so it runs with zero backend setup.
 */

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && serviceKey);
}

let client: SupabaseClient | null = null;

/** Returns the Supabase client, or null if Supabase isn't configured. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url as string, serviceKey as string, {
      auth: { persistSession: false },
    });
  }
  return client;
}
