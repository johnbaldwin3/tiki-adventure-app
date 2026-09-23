/**
 * Cookie options for the Supabase session cookies, shared by the proxy
 * (which refreshes the session on every navigation) and server code.
 *
 * How long a sign-in lasts (John asked for at least 10 days): @supabase/ssr
 * always gives its session cookies a 400-day lifetime (it overrides any
 * maxAge passed here), and the proxy refreshes the short-lived access token
 * on each visit, so you stay signed in until you sign out -- unless a
 * session time-box / inactivity timeout is turned on in Supabase Auth
 * settings (off by default). The e2e suite checks the cookie outlives 10 days.
 */
export const AUTH_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  secure: !!process.env.VERCEL,
};
