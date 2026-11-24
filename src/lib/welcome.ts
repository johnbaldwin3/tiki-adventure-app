/**
 * The "New here?" welcome card on the home page links to the guide (/guide).
 * It shows for anyone signed in until they hide it; hiding is remembered
 * per browser in a cookie (no database change), and the guide page can
 * bring it back.
 */
export const WELCOME_COOKIE = "ep_welcome";
export const WELCOME_HIDDEN = "hidden";
/** Browsers cap cookie lifetimes at 400 days. */
export const WELCOME_MAX_AGE = 400 * 24 * 60 * 60;

export function isWelcomeHidden(value: string | undefined): boolean {
  return value === WELCOME_HIDDEN;
}
