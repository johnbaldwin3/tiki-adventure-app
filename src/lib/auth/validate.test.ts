import { describe, expect, it } from "vitest";
import {
  friendlyAuthError,
  normalizeEmail,
  safeNextPath,
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
