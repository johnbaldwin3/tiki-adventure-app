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

/**
 * Only allow redirects back into this site after sign-in: a same-origin
 * path like "/cocktails/zombie/tasting/jb". Anything else (absolute URLs,
 * protocol-relative "//evil.com", backslash tricks) falls back to "/".
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  if (/[\u0000-\u001f]/.test(raw)) return "/";
  return raw;
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
  if (code === "weak_password") {
    return `Choose a stronger password (at least ${PASSWORD_MIN_LENGTH} characters).`;
  }
  if (code === "same_password") {
    return "That's already your password. Choose a different one.";
  }
  if (code.startsWith("over_") || error?.status === 429) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  return "Something went wrong. Please try again.";
}
