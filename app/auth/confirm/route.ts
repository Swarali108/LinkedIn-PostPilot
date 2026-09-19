import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Server-side email-link handler (password reset + signup confirm).
 *
 * Accepts either link shape, so recovery works whichever email template is in use:
 *   - `token_hash` + `type` (custom template) — verified with verifyOtp. Preferred:
 *     unlike PKCE it works even when the link is opened in a different browser.
 *   - `code` (Supabase default, PKCE) — exchanged for a session. Only succeeds in
 *     the browser that requested the reset, since the verifier is stored there.
 * A third shape, `#access_token=...`, never reaches the server; RecoveryHandler
 * picks that one up client-side.
 *
 * Either way the session cookies are set here, then we forward to `next` (/reset
 * for recovery) — which is what authorizes the password change.
 */
type CookieStore = Awaited<ReturnType<typeof cookies>>;

function makeClient(cookieStore: CookieStore) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          toSet: { name: string; value: string; options?: Record<string, unknown> }[]
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as any)
          );
        },
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") || "/";
  // Only ever redirect within this app — an attacker-supplied absolute URL here
  // would turn the confirm link into an open redirect.
  const dest = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const cookieStore = await cookies();

  if (token_hash && type) {
    const supabase = makeClient(cookieStore);
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${dest}`);
  } else if (code) {
    const supabase = makeClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${dest}`);
  }

  return NextResponse.redirect(`${origin}/login?error=invalid_or_expired_link`);
}
