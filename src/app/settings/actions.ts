"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { cleanInviteNote, createInviteProblem } from "@/lib/invites";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const back = (status: string): never => {
  revalidatePath("/settings");
  redirect(`/settings?invite=${status}#invites`);
};

/** Make a personal invite link (create_invite, migration 0019 checks the caps). */
export async function createInvite(fd: FormData): Promise<void> {
  const user = await getSignedInUser();
  if (!user?.taster) redirect("/login?next=%2Fsettings");
  const note = cleanInviteNote(String(fd.get("note") ?? ""));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_invite", { p_note: note });
  if (error) {
    console.error("settings: create_invite failed", error.message);
    back(createInviteProblem(error.message));
  }
  back("made");
}

/** Cancel an unused link. */
export async function revokeInvite(fd: FormData): Promise<void> {
  const user = await getSignedInUser();
  if (!user?.taster) redirect("/login?next=%2Fsettings");
  const id = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) back("error");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("revoke_invite", { p_id: id });
  back(error || data !== true ? "error" : "revoked");
}
