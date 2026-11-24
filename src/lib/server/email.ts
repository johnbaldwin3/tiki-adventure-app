import "server-only";

/**
 * App emails (an invite waiting for approval, an invite approved), sent
 * through Resend's API -- the same Resend account that delivers Supabase's
 * sign-in emails. Needs RESEND_API_KEY in Vercel (Production and Preview).
 * Without it, or if Resend fails, the email is skipped and logged: the
 * badge in the top bar still tells admins an approval is waiting.
 */

const TEST_OVERRIDES = process.env.VERCEL_ENV !== "production";
const DEFAULT_FROM = "Equal Parts <invites@equalparts.online>";

export interface AppEmail {
  to: string[];
  subject: string;
  text: string;
}

/** Sends one email per person, so recipients don't see each other's addresses. True if all went. */
export async function sendAppEmail({ to, subject, text }: AppEmail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const recipients = [...new Set(to.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (recipients.length === 0) return false;
  if (!key) {
    console.warn(`email: RESEND_API_KEY is not set, skipped "${subject}"`);
    return false;
  }
  const sent = await Promise.all(recipients.map((r) => sendOne(key, r, subject, text)));
  return sent.every(Boolean);
}

async function sendOne(key: string, to: string, subject: string, text: string): Promise<boolean> {
  // Tests point this at the mock; never overridable in production (the key goes wherever it points).
  const base = (TEST_OVERRIDES && process.env.RESEND_BASE_URL) || "https://api.resend.com";
  try {
    const res = await fetch(`${base}/emails`, {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.RESEND_FROM || DEFAULT_FROM, to: [to], subject, text }),
    });
    if (!res.ok) {
      console.error(`email: Resend refused "${subject}" (${res.status})`, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error(`email: couldn't send "${subject}"`, err);
    return false;
  }
}
