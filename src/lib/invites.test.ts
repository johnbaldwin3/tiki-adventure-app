import { describe, expect, it } from "vitest";
import { cleanInviteNote, createInviteProblem, expiresIn, inviteStatus, type InviteRow } from "./invites";

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
