/**
 * Transactional email (password reset, signup confirmation) via Resend's HTTP API.
 *
 * Without RESEND_API_KEY the email is logged to the server console instead, so
 * you can still click the link in local dev. On Vercel that would silently drop
 * real users' emails, so there it's an error.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (process.env.VERCEL) {
      const msg = "RESEND_API_KEY is not set — can't deliver email on Vercel.";
      console.error(`[email] ${msg} (to: ${to}, subject: ${subject})`);
      throw new Error(msg);
    }
    console.log(`\n[email] To: ${to}\n[email] Subject: ${subject}\n[email] ${html}\n`);
    return;
  }

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "PostPilot <onboarding@resend.dev>",
        to,
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error(`[email] Could not reach Resend (to: ${to}):`, err);
    throw new Error("Could not reach the email service.");
  }
  if (!res.ok) {
    // Resend's error body says exactly why (unverified domain, bad key, sandbox
    // recipient…). It never contains the API key.
    const detail = await res.text().catch(() => "");
    console.error(`[email] Resend rejected the email (HTTP ${res.status}, to: ${to}): ${detail}`);
    throw new Error(`Email send failed (HTTP ${res.status}).`);
  }
}

/** Minimal one-button email body. */
export function linkEmail(intro: string, cta: string, url: string): string {
  return `<p>${intro}</p><p><a href="${url}">${cta}</a></p><p style="color:#888;font-size:12px">If you didn't ask for this, you can ignore this email.</p>`;
}
