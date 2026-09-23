import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Set these in .env.local (see .env.example) and in the Vercel project's " +
      "environment variables."
  );
}

/**
 * Shared Supabase client for public, signed-out reads, using the
 * publishable/anon key only. Anonymous callers get SELECT and nothing else
 * (RLS, see supabase/migrations/). Writes never use this client: they go
 * through the signed-in user's session client in ./supabase-server.ts, so
 * the tasting RLS policies from migration 0003 apply.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
