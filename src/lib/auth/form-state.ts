import type { FieldErrors } from "./validate";

/**
 * Short-lived, httpOnly cookie set by /auth/confirm when a password-reset
 * link is opened. Changing the password requires it, so a signed-in session
 * alone can't be used to take over the account.
 */
export const RESET_COOKIE = "tiki_pw_reset";
export const RESET_COOKIE_MAX_AGE_SECONDS = 15 * 60;

/** State returned by the auth Server Actions (src/app/auth/actions.ts) to their forms. */
export interface AuthFormState {
  status: "idle" | "invalid" | "error" | "sent";
  /** Increments on every submit so the form re-mounts, re-announces and re-focuses. */
  submission: number;
  email: string;
  errors: FieldErrors<"email" | "password" | "confirm">;
  message: string | null;
}

export const initialAuthState: AuthFormState = {
  status: "idle",
  submission: 0,
  email: "",
  errors: {},
  message: null,
};
