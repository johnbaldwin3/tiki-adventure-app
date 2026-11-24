import "server-only";
import { cache } from "react";
import { getSignedInUser } from "./auth/current-taster";
import { groupPeople, NOBODY, type People, type Person } from "./people";
import { getReadClient } from "./read-client";

/**
 * The viewer's household and friends (see ./people). Signed out, or signed
 * in without a taster: nobody. Computed once per request.
 */
export const getPeople = cache(async (): Promise<People> => {
  const user = await getSignedInUser();
  if (!user?.taster) return NOBODY;
  const db = await getReadClient();
  const { data, error } = await db.from("tasters").select("id, initials, display_name, household_id");
  if (error) throw new Error(`Failed to fetch tasters: ${error.message}`);
  const visible: Person[] = (data ?? []).map((t) => ({
    id: t.id,
    initials: t.initials,
    displayName: t.display_name,
    householdId: t.household_id ?? null,
  }));
  return groupPeople(user.taster.id, visible);
});
