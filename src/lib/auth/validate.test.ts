import { describe, expect, it } from "vitest";
import {
  friendlyAuthError,
  inviteProblem,
  validateName,
  normalizeCode,
  normalizeEmail,
  safeNextPath,
  validateCode,
  validateNewPassword,
  validateSignIn,
  validateSignUp,
} from "./validate";

describe("validateSignIn", () => {
  it("accepts an email and password", () => {
    expect(validateSignIn(" John@Example.com ", "x")).toEqual({});
  });
  it("flags missing fields", () => {
    expect(validateSignIn("nope", "")).toEqual({
      email: "Enter your email address.",
      password: "Enter your password.",
    });
  });
});

describe("validateNewPassword / validateSignUp", () => {
  it("requires 8+ characters and a matching confirmation", () => {
    expect(validateNewPassword("short", "short").password).toMatch(/at least 8/);
    expect(validateNewPassword("long-enough", "different").confirm).toMatch(/don't match/);
    expect(validateNewPassword("long-enough", "long-enough")).toEqual({});
  });
  it("adds email validation for sign-up", () => {
    expect(validateSignUp("bad", "long-enough", "long-enough")).toEqual({
      email: "Enter a valid email address.",
    });
    expect(validateSignUp("a@b.co", "long-enough", "long-enough")).toEqual({});
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  John.Baldwin@Example.COM ")).toBe("john.baldwin@example.com");
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/cocktails/zombie/tasting/jb", "/cocktails/zombie/tasting/jb"],
    ["/stats?x=1", "/stats?x=1"],
    [null, "/"],
    ["", "/"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["javascript:alert(1)", "/"],
    ["/ok\nSet-Cookie: x", "/"],
    ["/.//evil.com", "/"],
    ["/..//evil.com", "/"],
    ["/%2e//evil.com", "/"],
    ["/a/..//evil.com", "/"],
    ["/cabinet#shelf", "/cabinet#shelf"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input as string | null)).toBe(expected);
  });
});

describe("friendlyAuthError", () => {
  it.each([
    [{ code: "invalid_credentials", message: "Invalid login credentials" }, /don't match/],
    [{ message: "Invalid login credentials" }, /don't match/],
    [{ code: "email_not_confirmed" }, /confirm your email/],
    [{ code: "user_already_exists" }, /already an account/],
    [{ status: 500, message: "Database error saving new user" }, /isn't on the tasters list/],
    [{ code: "unexpected_failure", status: 500, message: "Error sending confirmation email" }, /Something went wrong/],
    [{ code: "weak_password" }, /stronger password/],
    [{ code: "over_email_send_rate_limit", status: 429 }, /Too many attempts/],
    [{ code: "something_new" }, /Something went wrong/],
    [null, /Something went wrong/],
  ])("%j", (err, expected) => {
    expect(friendlyAuthError(err)).toMatch(expected);
  });
});

describe("sign-in codes", () => {
  it("accepts 6-10 digits, ignoring spaces and dashes", () => {
    expect(normalizeCode(" 123 456 ")).toBe("123456");
    expect(normalizeCode("123-456")).toBe("123456");
    expect(validateCode("123456")).toEqual({});
    expect(validateCode("12345678")).toEqual({});
    expect(validateCode("123 456")).toEqual({});
  });
  it("rejects anything else", () => {
    for (const bad of ["", "12345", "abcdef", "12345a", "12345678901"]) {
      expect(validateCode(bad).code).toMatch(/6-digit code/);
    }
  });
  it("explains wrong/expired codes and unknown emails", () => {
    expect(friendlyAuthError({ code: "otp_expired", message: "Token has expired or is invalid" })).toMatch(/wrong or has expired/);
    expect(friendlyAuthError({ code: "otp_disabled", message: "Signups not allowed for otp" })).toMatch(/no account for that email/);
  });
});

describe("validateName", () => {
  it("needs 1-40 characters with a letter", () => {
    expect(validateName("  Sam ")).toEqual({});
    expect(validateName("Zoë")).toEqual({});
    expect(validateName("   ")).toEqual({ name: "Enter your name." });
    expect(validateName("x".repeat(41))).toEqual({ name: "Use 40 characters or fewer." });
    expect(validateName("123")).toEqual({ name: "Use at least one letter." });
  });
});

describe("inviteProblem", () => {
  it("is null for ok and plain words otherwise", () => {
    expect(inviteProblem("ok")).toBeNull();
    expect(inviteProblem("email_taken")).toMatch(/already has an account/);
    expect(inviteProblem("used")).toMatch(/already been used/);
    expect(inviteProblem("expired")).toMatch(/expired/);
    expect(inviteProblem("revoked")).toMatch(/cancelled/);
    expect(inviteProblem("closed")).toMatch(/paused/);
    expect(inviteProblem("full")).toMatch(/full/);
    expect(inviteProblem("unknown")).toMatch(/isn't valid/);
    expect(inviteProblem("anything else")).toMatch(/isn't valid/);
  });
});
