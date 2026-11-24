import { describe, expect, it } from "vitest";
import {
  approvalNeededEmail,
  cleanInviteNote,
  createInviteProblem,
  expiresIn,
  inviteApprovedEmail,
  inviteEmail,
  inviteEmailText,
  inviteMailto,
  inviteStatus,
  pendingInviteLabel,
  type InviteRow,
} from "./invites";

const now = new Date("2026-11-24T12:00:00Z");
const row = (over: Partial<InviteRow> = {}): InviteRow => ({
  id: "i1",
  token: "t".repeat(64),
  note: null,
  created_at: "2026-11-20T12:00:00Z",
  expires_at: "2026-12-04T12:00:00Z",
  revoked_at: null,
  claimed_by: null,
  claimed_at: null,
  ...over,
});

describe("inviteStatus", () => {
  it("is open until claimed, revoked or expired", () => {
    expect(inviteStatus(row(), now)).toBe("open");
    expect(inviteStatus(row({ claimed_by: "x", claimed_at: "2026-11-21T00:00:00Z" }), now)).toBe("joined");
    expect(inviteStatus(row({ revoked_at: "2026-11-21T00:00:00Z" }), now)).toBe("revoked");
    expect(inviteStatus(row({ expires_at: "2026-11-24T12:00:00Z" }), now)).toBe("expired");
  });
  it("waits for an admin until approved (migration 0020)", () => {
    expect(inviteStatus(row({ approved_at: null }), now)).toBe("waiting");
    expect(inviteStatus(row({ approved_at: "2026-11-21T00:00:00Z" }), now)).toBe("open");
    expect(inviteStatus(row({ approved_at: null, expires_at: "2026-11-24T12:00:00Z" }), now)).toBe("expired");
    expect(inviteStatus(row({ approved_at: null, revoked_at: "2026-11-21T00:00:00Z", declined_at: "2026-11-21T00:00:00Z" }), now)).toBe("declined");
  });
  it("counts a claimed link as joined even after its expiry date", () => {
    expect(inviteStatus(row({ claimed_by: "x", expires_at: "2026-11-01T00:00:00Z" }), now)).toBe("joined");
  });
});

describe("cleanInviteNote", () => {
  it("trims, squashes spaces, caps at 60 and drops empty notes", () => {
    expect(cleanInviteNote("  Sam   and Alex ")).toBe("Sam and Alex");
    expect(cleanInviteNote("   ")).toBeNull();
    expect(cleanInviteNote("x".repeat(80))).toHaveLength(60);
  });
});

describe("createInviteProblem", () => {
  it("maps create_invite's messages", () => {
    expect(createInviteProblem("Invites are switched off right now.")).toBe("off");
    expect(createInviteProblem("The app is full for now.")).toBe("full");
    expect(createInviteProblem("You have too many unused invites. Revoke one first.")).toBe("too_many");
    expect(createInviteProblem("boom")).toBe("error");
    expect(createInviteProblem(undefined)).toBe("error");
  });
});

describe("expiresIn", () => {
  it("rounds up to whole days", () => {
    expect(expiresIn("2026-12-04T12:00:00Z", now)).toBe("Expires in 10 days");
    expect(expiresIn("2026-11-25T06:00:00Z", now)).toBe("Expires within a day");
  });
});

describe("inviteMailto", () => {
  const link = "https://equalparts.online/join/abc";
  const parts = (m: string) => {
    const q = new URLSearchParams(m.replace(/^mailto:\?/, ""));
    return { subject: q.get("subject"), body: q.get("body") ?? "" };
  };
  it("prefills a subject and a body with the link, greeting the note's name", () => {
    const m = inviteMailto(inviteEmail(link, "John", "Sam"));
    expect(m.startsWith("mailto:?subject=")).toBe(true);
    const { subject, body } = parts(m);
    expect(subject).toBe("John invited you to Equal Parts");
    expect(body.startsWith("Hi Sam,\n")).toBe(true);
    expect(body).toContain(`\n${link}\n`);
    expect(body.endsWith("Cheers,\nJohn")).toBe(true);
  });
  it("uses a plain greeting when the note isn't a name", () => {
    expect(parts(inviteMailto(inviteEmail(link, "John", "the neighbours #2"))).body.startsWith("Hi,\n")).toBe(true);
    expect(parts(inviteMailto(inviteEmail(link, "John", null))).body.startsWith("Hi,\n")).toBe(true);
  });
  it("encodes characters that would break the link", () => {
    expect(inviteMailto(inviteEmail(link, "A & B", null))).not.toContain(" & ");
  });
});

describe("inviteEmailText", () => {
  it("puts the subject line above the body, for pasting anywhere", () => {
    const text = inviteEmailText(inviteEmail("https://equalparts.online/join/abc", "John", "Sam"));
    expect(text.startsWith("Subject: John invited you to Equal Parts\n\nHi Sam,\n")).toBe(true);
    expect(text).toContain("https://equalparts.online/join/abc");
  });
});

describe("approval emails", () => {
  it("tells the admins who wants to invite whom, with the Settings link", () => {
    const e = approvalNeededEmail("https://equalparts.online/settings#approvals", "Fran", "Sam");
    expect(e.subject).toBe("Fran wants to invite someone to Equal Parts");
    expect(e.body).toContain("Fran made an invite link for Sam.");
    expect(e.body).toContain("https://equalparts.online/settings#approvals");
    expect(approvalNeededEmail("u", "Fran", null).body).toContain("Fran made an invite link. ");
  });
  it("tells the inviter their link is ready", () => {
    const e = inviteApprovedEmail("https://equalparts.online/settings#invites", "Fran", "Sam");
    expect(e.subject).toBe("Your Equal Parts invite for Sam is ready");
    expect(e.body).toMatch(/^Hi Fran,/);
  });
  it("labels a waiting link", () => {
    expect(pendingInviteLabel({ inviter: "Fran", note: "Sam" })).toBe("Fran's invite for Sam");
    expect(pendingInviteLabel({ inviter: "Fran", note: null })).toBe("Fran's invite");
  });
});
