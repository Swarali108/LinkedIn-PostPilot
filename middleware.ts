import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth gate. Allows a request through if EITHER a valid Supabase session OR the
 * guest cookie is present. Otherwise: pages → /login, API → 401. The landing
 * page (/) is public.
 *
 * Hardened: the Supabase check is wrapped so a transient/network/config error
 * can never hard-crash the middleware (which would 500 the whole site).
 */
export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = req.nextUrl.pathname;
  const isApi = path.startsWith("/api");
  const isPublic = path === "/";

  const deny = () => {
    if (isPublic) return NextResponse.next();
    if (isApi) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  };

  // Auth not configured → treat everyone as unauthenticated (send to /login).
  if (!url || !anon) return deny();

  let res = NextResponse.next({ request: req });
  let signedIn = false;

  try {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]
        ) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            res.cookies.set(name, value, options as any)
          );
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  } catch {
    // Never let an auth error crash the request — fall through as unauthenticated.
    signedIn = false;
  }

  const guest = req.cookies.get("pp_guest")?.value === "1";
  if (signedIn || guest || isPublic) return res;
  return deny();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|reset).*)"],
};
