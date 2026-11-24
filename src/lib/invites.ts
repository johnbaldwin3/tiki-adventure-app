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
}

export type InviteStatus = "open" | "joined" | "revoked" | "expired";

/** Where a link stands, the way claim_invite() sees it. */
export function inviteStatus(row: InviteRow, now: Date = new Date()): InviteStatus {
  if (row.revoked_at) return "revoked";
  if (row.claimed_by || row.claimed_at) return "joined";
  if (new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
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
