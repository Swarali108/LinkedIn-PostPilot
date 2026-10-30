import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth gate. Allows a request through if EITHER a session cookie OR the guest
 * cookie is present. Otherwise: pages → /login, API → 401. The landing page (/)
 * is public.
 *
 * This is an optimistic, cookie-only check (middleware runs on the edge and
 * can't query the database). It only decides where to route people — every data
 * route still validates the session against the DB via currentUserId(), so a
 * forged cookie gets nothing.
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isApi = path.startsWith("/api");
  const isPublic = path === "/";

  const signedIn = Boolean(getSessionCookie(req));
  const guest = req.cookies.get("pp_guest")?.value === "1";
  if (signedIn || guest || isPublic) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", path);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|reset|api/auth|api/reset).*)",
  ],
};
