"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { approvalNeededEmail, cleanInviteNote, createInviteProblem, inviteApprovedEmail } from "@/lib/invites";
import { sendAppEmail } from "@/lib/server/email";
import { appLinkOrigin } from "@/lib/site-origin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const back = (status: string, anchor = "invites"): never => {
  revalidatePath("/", "layout");
  redirect(`/settings?invite=${status}#${anchor}`);
};

const validId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

/**
 * Make a personal invite link (create_invite, migrations 0019 and 0020
 * check the caps). An admin's link works at once; anyone else's waits for
 * an admin, who gets an email about it.
 */
export async function createInvite(fd: FormData): Promise<void> {
  const user = await getSignedInUser();
  if (!user?.taster) redirect("/login?next=%2Fsettings");
  const note = cleanInviteNote(String(fd.get("note") ?? ""));
  const supabase = await createSupabaseServerClient();
  const { data: token, error } = await supabase.rpc("create_invite", { p_note: note });
  if (error) {
    console.error("settings: create_invite failed", error.message);
    back(createInviteProblem(error.message));
  }
  if (user.isAdmin) back("made");

  // Once per link, the admins' emails (admin_alert_emails, migration 0020).
  const { data: emails, error: alertError } = await supabase.rpc("admin_alert_emails", { p_token: String(token) });
  if (alertError) console.error("settings: admin_alert_emails failed", alertError.message);
  const to = Array.isArray(emails) ? emails.filter((e): e is string => typeof e === "string") : [];
  if (to.length > 0) {
    const origin = await appLinkOrigin();
    const email = approvalNeededEmail(`${origin}/settings#approvals`, user.taster.displayName, note);
    after(() => sendAppEmail({ to, subject: email.subject, text: email.body }));
  }
  back("waiting");
}

/** Cancel an unused link. */
export async function revokeInvite(fd: FormData): Promise<void> {
  const user = await getSignedInUser();
  if (!user?.taster) redirect("/login?next=%2Fsettings");
  const id = String(fd.get("id") ?? "");
  if (!validId(id)) back("error");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("revoke_invite", { p_id: id });
  back(error || data !== true ? "error" : "revoked");
}

/** Admins: OK a member's waiting link, and email them that it's ready. */
export async function approveInvite(fd: FormData): Promise<void> {
  const user = await getSignedInUser();
  if (!user?.taster) redirect("/login?next=%2Fsettings");
  const id = String(fd.get("id") ?? "");
  if (!user.isAdmin || !validId(id)) back("error", "approvals");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("approve_invite", { p_id: id });
  const row = (Array.isArray(data) ? data[0] : data) as { inviter_email?: string | null; inviter_name?: string | null; note?: string | null } | null;
  if (error || !row) {
    if (error) console.error("settings: approve_invite failed", error.message);
    back("gone", "approvals");
  }
  if (row?.inviter_email) {
    const origin = await appLinkOrigin();
    const email = inviteApprovedEmail(`${origin}/settings#invites`, row.inviter_name ?? "there", row.note ?? null);
    const to = [row.inviter_email];
    after(() => sendAppEmail({ to, subject: email.subject, text: email.body }));
  }
  back("approved", "approvals");
}

/** Admins: say no to a member's waiting link. */
export async function declineInvite(fd: FormData): Promise<void> {
  const user = await getSignedInUser();
  if (!user?.taster) redirect("/login?next=%2Fsettings");
  const id = String(fd.get("id") ?? "");
  if (!user.isAdmin || !validId(id)) back("error", "approvals");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("decline_invite", { p_id: id });
  if (error) console.error("settings: decline_invite failed", error.message);
  back(error ? "error" : data === true ? "declined" : "gone", "approvals");
}
