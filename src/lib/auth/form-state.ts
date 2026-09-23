import type { FieldErrors } from "./validate";

/**
 * Short-lived, httpOnly cookie set by /auth/confirm when a password-reset
 * link is opened. The app only shows/accepts the change-password form while
 * it's present. This is a UX guard (it keeps the form tied to the reset
 * email), not a security control: the value isn't bound to a user, and a
 * session token can call Supabase's update-user endpoint directly. The real
 * protection is Supabase Auth's "Secure password change" setting.
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
