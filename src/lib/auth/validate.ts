/**
 * Pure helpers for the sign-in / sign-up / password pages.
 * No Next or Supabase imports, so they're unit-testable.
 */

export const PASSWORD_MIN_LENGTH = 8;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateSignIn(email: string, password: string): FieldErrors<"email" | "password"> {
  const errors: FieldErrors<"email" | "password"> = {};
  if (!EMAIL_PATTERN.test(normalizeEmail(email))) errors.email = "Enter your email address.";
  if (password === "") errors.password = "Enter your password.";
  return errors;
}

/** Supabase emails a 6-digit code by default (the length is a project setting, 6-10). */
export function normalizeCode(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

export function validateCode(code: string): FieldErrors<"code"> {
  return /^\d{6,10}$/.test(normalizeCode(code)) ? {} : { code: "Enter the 6-digit code from the email." };
}

export function validateNewPassword(
  password: string,
  confirm: string
): FieldErrors<"password" | "confirm"> {
  const errors: FieldErrors<"password" | "confirm"> = {};
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (confirm !== password) {
    errors.confirm = "The passwords don't match.";
  }
  return errors;
}

export function validateSignUp(
  email: string,
  password: string,
  confirm: string
): FieldErrors<"email" | "password" | "confirm"> {
  const errors: FieldErrors<"email" | "password" | "confirm"> = validateNewPassword(password, confirm);
  if (!EMAIL_PATTERN.test(normalizeEmail(email))) errors.email = "Enter a valid email address.";
  return errors;
}

/** A new member's name on the join page: 1-40 characters, with at least one letter. */
export function validateName(raw: string): FieldErrors<"name"> {
  const name = raw.trim();
  if (name === "") return { name: "Enter your name." };
  if (name.length > 40) return { name: "Use 40 characters or fewer." };
  if (!/\p{L}/u.test(name)) return { name: "Use at least one letter." };
  return {};
}

/** Why claim_invite (migration 0019) refused, in plain words. */
export function inviteProblem(result: string): string | null {
  switch (result) {
    case "ok":
      return null;
    case "bad_name":
      return "Enter your name.";
    case "bad_email":
      return "Enter a valid email address.";
    case "email_taken":
      return "That email already has an account. Sign in instead.";
    case "used":
      return "This invite has already been used. If it was yours, sign in instead.";
    case "expired":
      return "This invite has expired. Ask for a new one.";
    case "revoked":
      return "This invite was cancelled. Ask for a new one.";
    case "closed":
      return "New invites are paused right now. Try again later.";
    case "pending":
      return "This invite is still waiting for an admin to approve it. Try the link again once whoever invited you says it's ready.";
    case "full":
      return "The app is full for now. Ask whoever invited you.";
    default:
      return "That invite link isn't valid. Check you have the whole link.";
  }
}

/**
 * Only allow redirects back into this site after sign-in: a same-origin
 * path like "/cocktails/zombie/tasting/jb". Anything else (absolute URLs,
 * protocol-relative "//evil.com", backslash or dot-segment tricks) falls
 * back to "/". Returns the normalised path.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  if (/[\u0000-\u001f]/.test(raw)) return "/";
  // Resolve dot segments the way a browser would: "/.//evil.com" must not
  // turn into the protocol-relative "//evil.com" later on.
  const base = "http://local.invalid";
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return "/";
  }
  if (url.origin !== base || url.pathname.startsWith("//")) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}

interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

/** Turns Supabase Auth errors into plain-English messages for the forms. */
export function friendlyAuthError(error: AuthErrorLike | null | undefined): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) {
    return "That email and password don't match. Try again, or reset your password.";
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(message)) {
    return "Please confirm your email first. Check your inbox for the link we sent.";
  }
  if (code === "user_already_exists" || /already registered/i.test(message)) {
    return "There's already an account for that email. Sign in instead.";
  }
  // Our sign-up trigger (migration 0003) rejects emails that aren't a
  // registered taster; Supabase reports that as a generic database error.
  // (Match the message only: "unexpected_failure" is Supabase's generic
  // 500 code and also covers e.g. a failed confirmation email.)
  if (/database error saving new user/i.test(message)) {
    return "That email isn't on the tasters list, so it can't be used to sign up.";
  }
  if (code === "otp_expired" || /token has expired or is invalid/i.test(message)) {
    return "That code is wrong or has expired. Check the latest email, or send a new code.";
  }
  if (code === "otp_disabled" || code === "signup_disabled" || /signups not allowed/i.test(message)) {
    return "There's no account for that email yet. Ask John or Genny for an invite.";
  }
  if (code === "weak_password") {
    return `Choose a stronger password (at least ${PASSWORD_MIN_LENGTH} characters).`;
  }
  if (code === "reauthentication_needed" || /reauthenticat/i.test(message)) {
    return "For security, sign out and back in with a code, then set your password.";
  }
  if (code === "same_password") {
    return "That's already your password. Choose a different one.";
  }
  if (code.startsWith("over_") || error?.status === 429) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  return "Something went wrong. Please try again.";
}
