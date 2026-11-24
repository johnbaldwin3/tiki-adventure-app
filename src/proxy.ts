import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_OPTIONS } from "@/lib/auth/cookies";
import { isPublicPath } from "@/lib/auth/public-paths";

/**
 * Keeps Supabase sign-ins fresh (Next 16 "proxy", formerly middleware).
 * Access tokens are short-lived; on each navigation this refreshes an
 * expiring one and writes the new session cookies onto both the request -- so the page render
 * sees it -- and the response -- so the browser keeps it (see
 * src/lib/auth/cookies.ts for how long sign-ins last).
 * Also: signed-out visitors only get the landing and sign-in pages
 * (src/lib/auth/public-paths.ts); anything else goes to sign in, then back.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    }
  );

  // Refreshes the session if needed. Don't put code between creating the
  // client and this call, or sessions can get out of sync.
  const { data } = await supabase.auth.getClaims();

  const { pathname, search } = request.nextUrl;
  if (!data?.claims && !isPublicPath(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(login);
    // Keep any cookie changes (e.g. a cleared, expired session).
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
