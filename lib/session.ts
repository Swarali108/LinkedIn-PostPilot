import { headers } from "next/headers";
import { auth } from "./auth";
import { isDbConfigured } from "./db";

/**
 * The authenticated user for this request (validated against the session table),
 * or null when not signed in. Used by route handlers / server components.
 */
export async function getSessionUser(): Promise<{ id: string } | null> {
  if (!isDbConfigured()) return null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session ? { id: session.user.id } : null;
  } catch {
    // A DB hiccup must not 500 the request — treat as signed out.
    return null;
  }
}
