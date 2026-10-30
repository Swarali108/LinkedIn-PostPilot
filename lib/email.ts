/**
 * Transactional email (password reset, signup confirmation) via Resend's HTTP API.
 *
 * When RESEND_API_KEY isn't set (local dev) the email is logged to the server
 * console instead, so you can still click the link.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[email] To: ${to}\n[email] Subject: ${subject}\n[email] ${html}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "PostPilot <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    throw new Error(`Email send failed (${res.status}): ${await res.text()}`);
  }
}

/** Minimal one-button email body. */
export function linkEmail(intro: string, cta: string, url: string): string {
  return `<p>${intro}</p><p><a href="${url}">${cta}</a></p><p style="color:#888;font-size:12px">If you didn't ask for this, you can ignore this email.</p>`;
}
