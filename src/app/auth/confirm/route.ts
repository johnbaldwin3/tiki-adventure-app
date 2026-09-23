import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { RESET_COOKIE, RESET_COOKIE_MAX_AGE_SECONDS } from "@/lib/auth/form-state";
import { safeNextPath } from "@/lib/auth/validate";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Landing point for links in Supabase auth emails (confirm sign-up, reset
 * password). Supports both link styles:
 *  - ?code=...                   PKCE (default templates via @supabase/ssr)
 *  - ?token_hash=...&type=...    custom email templates
 * On success the session cookie is set and we continue to ?next=.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createSupabaseServerClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  // Redirect on the host the browser actually used (behind Vercel's proxy,
  // or 127.0.0.1 vs localhost locally) so the session cookie just set applies.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const target = ok ? next : "/login?error=link";
  const response = NextResponse.redirect(new URL(target, `${proto}://${host}`));
  if (ok && next === "/reset-password") {
    response.cookies.set(RESET_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: !!process.env.VERCEL,
      path: "/",
      maxAge: RESET_COOKIE_MAX_AGE_SECONDS,
    });
  }
  return response;
}
