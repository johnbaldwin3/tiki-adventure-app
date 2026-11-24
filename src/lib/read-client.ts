import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "./supabase-server";

/**
 * The client for page reads: the viewer's session, so the database's
 * row-level security (migration 0018) decides whose ratings, tasters and
 * home-made recipes they see. Signed out it acts as the anon key (catalog
 * only). One per request.
 */
export const getReadClient = cache(() => createSupabaseServerClient());
