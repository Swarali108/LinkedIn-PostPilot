/**
 * Startup sanity check for server config. Logs (never throws) so a misconfigured
 * deployment says exactly what's wrong in the logs instead of failing with a bare
 * 500 on every auth request. Values are never printed — only variable names.
 */

// Text from .env.example that means "you forgot to fill this in".
const PLACEHOLDER = /your_|yourdomain|ep-xxxx|user:password@|your-project/i;

let checked = false;

export function checkEnv(): void {
  if (checked) return;
  checked = true;

  const env = process.env;
  const errors: string[] = [];
  const warnings: string[] = [];
  const onVercel = Boolean(env.VERCEL);

  const need = (name: string, hint: string) => {
    const v = env[name]?.trim();
    if (!v) errors.push(`${name} is missing — ${hint}`);
    else if (PLACEHOLDER.test(v)) errors.push(`${name} still has the placeholder from .env.example — ${hint}`);
  };

  need("DATABASE_URL", "set it to your Neon pooled connection string.");
  need("BETTER_AUTH_SECRET", "set it to a random 32+ byte secret (see .env.example).");
  if (env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length < 32) {
    errors.push("BETTER_AUTH_SECRET is shorter than 32 characters — generate a longer one.");
  }

  if (!env.NEXT_PUBLIC_SITE_URL && !env.BETTER_AUTH_URL) {
    if (env.VERCEL_URL) {
      warnings.push(
        `NEXT_PUBLIC_SITE_URL is not set — using https://${env.VERCEL_URL} for auth and email links.`
      );
    } else {
      errors.push("NEXT_PUBLIC_SITE_URL is missing — set it to the site's public URL.");
    }
  } else if (env.NEXT_PUBLIC_SITE_URL && PLACEHOLDER.test(env.NEXT_PUBLIC_SITE_URL)) {
    errors.push("NEXT_PUBLIC_SITE_URL still has the placeholder from .env.example.");
  }

  if (!env.RESEND_API_KEY?.trim()) {
    (onVercel ? errors : warnings).push(
      "RESEND_API_KEY is missing — confirmation and reset emails will NOT be delivered" +
        (onVercel ? "." : " (they're printed to this console instead).")
    );
  } else {
    const from = env.EMAIL_FROM?.trim();
    if (!from) {
      warnings.push(
        "EMAIL_FROM is missing — using onboarding@resend.dev, which can only send to the Resend account owner's address."
      );
    } else if (PLACEHOLDER.test(from)) {
      errors.push("EMAIL_FROM still has the placeholder from .env.example — use an address on a domain verified in Resend.");
    } else if (/@resend\.dev>?$/i.test(from)) {
      warnings.push("EMAIL_FROM uses resend.dev — it can only send to the Resend account owner's address.");
    }
  }

  for (const e of errors) console.error(`[env] ✗ ${e}`);
  for (const w of warnings) console.warn(`[env] ! ${w}`);
}
