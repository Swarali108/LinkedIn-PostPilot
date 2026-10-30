import { getSessionUser } from "./session";

/** The authenticated user's id from the session, or null for guests. Data routes
 * derive the partition key from THIS — never from client-supplied input. */
export async function currentUserId(): Promise<string | null> {
  const user = await getSessionUser();
  return user?.id ?? null;
}
