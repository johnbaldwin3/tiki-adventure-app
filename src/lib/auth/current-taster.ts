import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "../supabase-server";

export interface SignedInUser {
  email: string;
  /** The taster this account belongs to, or null if the email isn't linked to one. */
  taster: { id: string; initials: string; displayName: string } | null;
}

/**
 * Who is signed in, and which taster they are. getUser() checks the
 * session with Supabase Auth (not just the cookie), and the taster comes
 * from the DB's current_taster_id() -- the same function RLS uses, so the
 * UI and the database always agree on who may edit what.
 * cache(): computed once per request, however many components ask.
 */
export const getSignedInUser = cache(async (): Promise<SignedInUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: tasterId } = await supabase.rpc("current_taster_id");
  if (typeof tasterId !== "string") return { email: user.email, taster: null };

  const { data: taster } = await supabase
    .from("tasters")
    .select("id, initials, display_name")
    .eq("id", tasterId)
    .maybeSingle();
  return {
    email: user.email,
    taster: taster
      ? { id: taster.id, initials: taster.initials, displayName: taster.display_name }
      : null,
  };
});
