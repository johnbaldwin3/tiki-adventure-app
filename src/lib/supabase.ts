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
 * Shared Supabase client, using the publishable/anon key only.
 *
 * RLS on every table currently allows public SELECT and nothing else (see
 * supabase/migrations/0001_init_schema.sql), so this client can safely be
 * used from both server and client components -- there is no write access
 * until Phase 7 auth introduces real write policies.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
