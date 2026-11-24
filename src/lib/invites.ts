/**
 * Pure helpers for invite links (migration 0019). No Next or Supabase
 * imports, so they're unit-testable.
 */

export interface InviteRow {
  id: string;
  token: string;
  note: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  /** Migration 0020: null while the link waits for an admin's OK. */
  approved_at?: string | null;
  /** Migration 0020: an admin said no (revoked_at is set too). */
  declined_at?: string | null;
}

export type InviteStatus = "open" | "waiting" | "joined" | "revoked" | "declined" | "expired";

/** Where a link stands, the way claim_invite() sees it. */
export function inviteStatus(row: InviteRow, now: Date = new Date()): InviteStatus {
  if (row.declined_at) return "declined";
  if (row.revoked_at) return "revoked";
  if (row.claimed_by || row.claimed_at) return "joined";
  if (new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
  // undefined: a row read before migration 0020 ran, when every link worked at once.
  if (row.approved_at === null) return "waiting";
  return "open";
}

export const INVITE_NOTE_MAX = 60;

/** The note on a new link ("Sam"): trimmed, at most 60 characters, or null. */
export function cleanInviteNote(raw: string): string | null {
  const note = raw.replace(/\s+/g, " ").trim().slice(0, INVITE_NOTE_MAX).trim();
  return note === "" ? null : note;
}

/** Why create_invite() refused, from its error message, as a short code for the URL. */
export function createInviteProblem(message: string | null | undefined): "off" | "full" | "too_many" | "error" {
  const m = message ?? "";
  if (/switched off/i.test(m)) return "off";
  if (/app is full/i.test(m)) return "full";
  if (/too many unused/i.test(m)) return "too_many";
  return "error";
}

/** "Expires in 3 days" / "Expires today", for an open link. */
export function expiresIn(expiresAt: string, now: Date = new Date()): string {
  const days = Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000);
  if (days <= 1) return "Expires within a day";
  return `Expires in ${days} days`;
}

/**
 * A ready-to-send invite email, which the inviter sends from their own mail
 * app or service (nothing is sent by us). The note ("Sam") becomes the greeting
 * when it looks like a name.
 */
export interface InviteEmail {
  subject: string;
  body: string;
}

export function inviteEmail(url: string, inviter: string, note: string | null): InviteEmail {
  const greeting = note && /^[\p{L}][\p{L} '.-]{0,40}$/u.test(note) ? `Hi ${note},` : "Hi,";
  const subject = `${inviter} invited you to Equal Parts`;
  const body = [
    greeting,
    "",
    "I'm using Equal Parts, a little home bar app for friends & family: a tasting log, what's in your bar, and a recipe library. Join me and we can see each other's ratings.",
    "",
    "Here's your personal invite link (it works once and expires in 14 days):",
    url,
    "",
    "Open it, add your name and email, and type the code it emails you. No password needed.",
    "",
    "Cheers,",
    inviter,
  ].join("\n");
  return { subject, body };
}

/** The same email as a mailto: link, for the inviter's default mail app. */
export function inviteMailto({ subject, body }: InviteEmail): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The same email as plain text, to paste into any email service. */
export function inviteEmailText({ subject, body }: InviteEmail): string {
  return `Subject: ${subject}\n\n${body}`;
}

/** A link waiting for an admin (pending_invites(), migration 0020). */
export interface PendingInvite {
  id: string;
  note: string | null;
  inviter: string;
  created_at: string;
}

/** "Fran's invite for Sam" / "Fran's invite". */
export function pendingInviteLabel(p: Pick<PendingInvite, "inviter" | "note">): string {
  return p.note ? `${p.inviter}'s invite for ${p.note}` : `${p.inviter}'s invite`;
}

/** The email to the admins when a member's invite needs their OK. */
export function approvalNeededEmail(settingsUrl: string, inviter: string, note: string | null): InviteEmail {
  const forWho = note ? ` for ${note}` : "";
  return {
    subject: `${inviter} wants to invite someone to Equal Parts`,
    body: [
      "Hi,",
      "",
      `${inviter} made an invite link${forWho}. It won't work until an admin approves it.`,
      "",
      "Approve or decline it in Settings:",
      settingsUrl,
      "",
      "Equal Parts",
    ].join("\n"),
  };
}

/** The email to the inviter when an admin approves their link. */
export function inviteApprovedEmail(settingsUrl: string, inviterName: string, note: string | null): InviteEmail {
  const forWho = note ? ` for ${note}` : "";
  return {
    subject: `Your Equal Parts invite${forWho} is ready`,
    body: [
      `Hi ${inviterName},`,
      "",
      `Your invite link${forWho} was approved. Open Settings to copy it or email it. It works once and expires in 14 days.`,
      "",
      settingsUrl,
      "",
      "Equal Parts",
    ].join("\n"),
  };
}
