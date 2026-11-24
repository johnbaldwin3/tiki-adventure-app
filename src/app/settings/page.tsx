import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { SubmitButton } from "@/components/submit-button";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validate";
import {
  expiresIn,
  INVITE_NOTE_MAX,
  inviteEmail,
  inviteEmailText,
  inviteMailto,
  inviteStatus,
  pendingInviteLabel,
  type InviteRow,
} from "@/lib/invites";
import { getPendingInvites } from "@/lib/pending-invites-data";
import { getPeople } from "@/lib/people-data";
import { appLinkOrigin } from "@/lib/site-origin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { setPassword } from "../auth/actions";
import { AuthForm } from "../auth/auth-form";
import { approveInvite, createInvite, declineInvite, revokeInvite } from "./actions";
import { CopyLink } from "./copy-link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings", robots: { index: false } };

const card = "rounded-2xl bg-card p-4 shadow-sm";
const heading = "text-sm font-bold uppercase tracking-wide text-ink-soft";

const INVITE_MESSAGES: Record<string, { role: "status" | "alert"; text: string }> = {
  made: { role: "status", text: "Invite link ready. Copy it and send it to them yourself." },
  waiting: {
    role: "status",
    text: "Invite made. An admin needs to approve it first: we've let them know, and we'll email you when the link is ready to send.",
  },
  revoked: { role: "status", text: "Invite cancelled. That link won't work any more." },
  off: { role: "alert", text: "Invites are switched off right now." },
  full: { role: "alert", text: "The app is full for now, so no new invites." },
  too_many: { role: "alert", text: "You have too many unused invites. Cancel one first." },
  error: { role: "alert", text: "Something went wrong. Please try again." },
};

const APPROVAL_MESSAGES: Record<string, { role: "status" | "alert"; text: string }> = {
  approved: { role: "status", text: "Approved. We've emailed them that their link is ready." },
  declined: { role: "status", text: "Declined. That invite won't work." },
  gone: { role: "alert", text: "That invite was already handled, cancelled or expired." },
  error: { role: "alert", text: "Something went wrong. Please try again." },
};

const STATUS_LABEL = {
  open: "Not used yet",
  waiting: "Waiting for an admin to approve",
  joined: "Joined",
  revoked: "Cancelled",
  declined: "Not approved",
  expired: "Expired",
} as const;

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const user = await getSignedInUser();
  if (!user) redirect("/login?next=%2Fsettings");
  if (!user.taster) redirect("/");
  const sp = await searchParams;
  const code = typeof sp.invite === "string" ? sp.invite : "";
  const approvalCodes = ["approved", "declined", "gone"];
  const flash = approvalCodes.includes(code) ? undefined : INVITE_MESSAGES[code];
  const approvalFlash = approvalCodes.includes(code) ? APPROVAL_MESSAGES[code] : undefined;

  const supabase = await createSupabaseServerClient();
  const [{ data: inviteData, error: inviteError }, people, origin, pending] = await Promise.all([
    supabase
      .from("invites")
      .select("id, token, note, created_at, expires_at, revoked_at, claimed_by, claimed_at, approved_at, declined_at")
      .eq("invited_by", user.taster.id)
      .order("created_at", { ascending: false }),
    getPeople(),
    appLinkOrigin(),
    getPendingInvites(),
  ]);
  if (inviteError) console.error("settings: failed to load invites", inviteError.message);
  const invites = (inviteData ?? []) as InviteRow[];
  const names = new Map([...people.household, ...people.friends].map((p) => [p.id, p.displayName]));
  const now = new Date();
  const myName = user.taster.displayName;

  return (
    <PageShell eyebrow="Your account" title="Settings" icon="⚙️">
      {user.isAdmin && (
        <section id="approvals" aria-labelledby="approvals-heading" className={`${card} scroll-mt-4`}>
          <h2 id="approvals-heading" className={heading}>
            Invites to approve
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            When a member who isn&apos;t an admin makes an invite, it waits here. Their link starts working once you approve it.
          </p>
          {approvalFlash && (
            <p
              role={approvalFlash.role}
              className={`mt-3 rounded-2xl border bg-card p-3 text-sm shadow-sm ${
                approvalFlash.role === "alert" ? "border-coral/30 text-coral-deep" : "border-teal/30 text-teal-deep"
              }`}
            >
              {approvalFlash.text}
            </p>
          )}
          {pending === null ? (
            <p role="alert" className="mt-3 text-sm text-coral-deep">
              Couldn&apos;t load invites waiting for approval right now.
            </p>
          ) : pending.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">Nothing waiting.</p>
          ) : (
            <ul aria-label="Invites to approve" className="mt-3 flex flex-col gap-3">
              {pending.map((p) => {
                const label = pendingInviteLabel(p);
                return (
                  <li key={p.id} className="rounded-xl border border-coral/25 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <strong className="text-ink">{label}</strong>
                      <span className="text-xs font-semibold text-ink-soft">Made {dateFormat.format(new Date(p.created_at))}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <form action={approveInvite}>
                        <input type="hidden" name="id" value={p.id} />
                        <SubmitButton
                          className="rounded-full bg-teal-deep px-4 py-2 text-sm font-bold text-white shadow-sm"
                          pendingText="Approving…"
                          aria-label={`Approve ${label}`}
                        >
                          Approve
                        </SubmitButton>
                      </form>
                      <form action={declineInvite}>
                        <input type="hidden" name="id" value={p.id} />
                        <SubmitButton
                          className="text-sm font-semibold text-coral-deep underline-offset-2 hover:underline"
                          pendingText="Declining…"
                          aria-label={`Decline ${label}`}
                        >
                          Decline
                        </SubmitButton>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="password-heading" className={card}>
        <h2 id="password-heading" className={heading}>
          Password
        </h2>
        <p className="mt-1 mb-3 text-sm text-ink-soft">
          Your email is <strong className="text-ink">{user.email}</strong>. You can always sign in with a code we email there.
          Set a password if you&apos;d rather type one.
        </p>
        <AuthForm
          action={setPassword}
          submitLabel="Save password"
          pendingLabel="Saving…"
          fields={[
            {
              id: "password",
              label: "New password",
              type: "password",
              autoComplete: "new-password",
              hint: `At least ${PASSWORD_MIN_LENGTH} characters.`,
            },
            { id: "confirm", label: "Confirm password", type: "password", autoComplete: "new-password" },
          ]}
        />
      </section>

      <section id="invites" aria-labelledby="invites-heading" className={`${card} scroll-mt-4`}>
        <h2 id="invites-heading" className={heading}>
          Invite a friend
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Make a link for each person, then copy it, email it, or copy a ready-made email to paste into any email service. Once they join, you&apos;ll see each other&apos;s
          ratings. Links work once and expire after 14 days.
          {!user.isAdmin && " An admin approves each new invite first, and we email you when it's ready to send."}
        </p>

        {flash && (
          <p
            role={flash.role}
            className={`mt-3 rounded-2xl border bg-card p-3 text-sm shadow-sm ${
              flash.role === "alert" ? "border-coral/30 text-coral-deep" : "border-teal/30 text-teal-deep"
            }`}
          >
            {flash.text}
          </p>
        )}

        <form action={createInvite} className="mt-3 flex flex-col gap-2">
          <label htmlFor="invite-note" className="text-sm font-semibold text-ink">
            Who is it for? <span className="font-normal text-ink-soft">(just for you, to tell your links apart)</span>
          </label>
          <input
            id="invite-note"
            name="note"
            maxLength={INVITE_NOTE_MAX}
            placeholder="e.g. Sam"
            className="w-full rounded-xl border border-teal bg-card px-3 py-2 text-ink"
          />
          <SubmitButton className="w-fit rounded-full bg-teal-deep px-4 py-2 text-sm font-bold text-white shadow-sm" pendingText="Making…">
            Make an invite link
          </SubmitButton>
        </form>

        {inviteError ? (
          <p role="alert" className="mt-4 text-sm text-coral-deep">
            Couldn&apos;t load your invites right now.
          </p>
        ) : invites.length > 0 ? (
          <ul aria-label="Your invites" className="mt-4 flex flex-col gap-3">
            {invites.map((inv) => {
              const status = inviteStatus(inv, now);
              const who = inv.note ?? "Invite";
              const url = `${origin}/join/${inv.token}`;
              const email = inviteEmail(url, myName, inv.note);
              return (
                <li key={inv.id} className="rounded-xl border border-teal/15 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <strong className="text-ink">{who}</strong>
                    <span className="text-xs font-semibold text-ink-soft">
                      {status === "joined" && inv.claimed_by && names.get(inv.claimed_by)
                        ? `Joined as ${names.get(inv.claimed_by)}`
                        : status === "open"
                          ? `${STATUS_LABEL.open} · ${expiresIn(inv.expires_at, now)}`
                          : STATUS_LABEL[status]}
                    </span>
                  </div>
                  {status === "waiting" && (
                    <p className="mt-1 text-sm text-ink-soft">The link appears here once it&apos;s approved. We&apos;ll email you too.</p>
                  )}
                  {(status === "open" || status === "waiting") && (
                    <div className="mt-2 flex flex-col gap-2">
                      {status === "open" && (
                        <CopyLink
                          url={url}
                          label={`Invite link for ${who}`}
                          mailto={inviteMailto(email)}
                          emailText={inviteEmailText(email)}
                        />
                      )}
                      <form action={revokeInvite}>
                        <input type="hidden" name="id" value={inv.id} />
                        <SubmitButton className="text-sm font-semibold text-coral-deep underline-offset-2 hover:underline" pendingText="Cancelling…">
                          Cancel this invite
                        </SubmitButton>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </PageShell>
  );
}
