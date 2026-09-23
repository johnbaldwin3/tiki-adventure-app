import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AUTH_COOKIE_OPTIONS } from "./auth/cookies";

/**
 * Per-request Supabase client that carries the signed-in user's session
 * (from cookies). Writes made with it run as that user, so the RLS policies
 * in supabase/migrations/0003_taster_auth.sql decide what's allowed -- a
 * taster can only insert/update their own tastings.
 *
 * Public, signed-out reads keep using the plain client in ./supabase.ts.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: src/proxy.ts refreshes and re-sets the session
            // cookies before every page render.
          }
        },
      },
    }
  );
}
