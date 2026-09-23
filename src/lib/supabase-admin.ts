import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for tasting writes (Phase 4). Bypasses RLS,
 * so it must never reach the browser: `server-only` makes any client-side
 * import a build error, and the key is deliberately NOT a NEXT_PUBLIC_ var.
 *
 * Only used when tastingWritesEnabled() is true -- off in production until
 * Phase 7 sign-in can tell us who is saving.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Tasting writes need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
