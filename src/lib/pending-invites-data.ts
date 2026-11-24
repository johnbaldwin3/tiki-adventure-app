import "server-only";
import { cache } from "react";
import { getSignedInUser } from "./auth/current-taster";
import type { PendingInvite } from "./invites";
import { createSupabaseServerClient } from "./supabase-server";

/**
 * Members' invite links waiting for an admin's OK (pending_invites(),
 * migration 0020), oldest first. Empty for non-admins. null if the lookup
 * failed. cache(): the top bar's badge and Settings share one call.
 */
export const getPendingInvites = cache(async (): Promise<PendingInvite[] | null> => {
  const user = await getSignedInUser();
  if (!user?.isAdmin) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("pending_invites");
  if (error) {
    console.error("pending invites: lookup failed", error.message);
    return null;
  }
  return (Array.isArray(data) ? data : []) as PendingInvite[];
});
