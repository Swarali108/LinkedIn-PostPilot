import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/user-context";

export const runtime = "nodejs";

/** Tells the client which storage mode to use:
 *  - "user": logged in → persist via server (Postgres, scoped to this user)
 *  - "guest": no account → session-only (client sessionStorage) */
export async function GET() {
  const userId = await currentUserId();
  return NextResponse.json({
    mode: userId ? "user" : "guest",
    userId,
  });
}
