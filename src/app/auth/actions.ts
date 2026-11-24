"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { siteOrigin } from "@/lib/site-origin";
import {
  friendlyAuthError,
  normalizeCode,
  normalizeEmail,
  safeNextPath,
  validateNewPassword,
  validateCode,
  validateSignIn,
  validateSignUp,
  validateName,
  inviteProblem,
} from "@/lib/auth/validate";
import { RESET_COOKIE, type AuthFormState, type CodeFormState } from "@/lib/auth/form-state";

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

export async function signIn(prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const submission = prev.submission + 1;
  const email = normalizeEmail(str(fd, "email"));
  const password = str(fd, "password");
  const next = safeNextPath(str(fd, "next"));

  const errors = validateSignIn(email, password);
  if (Object.keys(errors).length) {
    return { status: "invalid", submission, email, errors, message: "Please fix the highlighted fields." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { status: "error", submission, email, errors: {}, message: friendlyAuthError(error) };
  }
  revalidatePath("/", "layout");
  redirect(next);
}

/**
 * Step 1 of code sign-in: email a one-time code. Only existing accounts get
 * one (shouldCreateUser: false); new people will join by invite instead.
 * The code is typed into this same tab, so it works even when the email
 * opens in a mail app's own browser or on another device.
 */
export async function requestSignInCode(prev: CodeFormState, fd: FormData): Promise<CodeFormState> {
  const submission = prev.submission + 1;
  const email = normalizeEmail(str(fd, "email"));
  const { email: emailError } = validateSignIn(email, "x");
  if (emailError) {
    return { step: "email", status: "invalid", submission, email, errors: { email: emailError }, message: "Please fix the highlighted fields." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) {
    return { step: "email", status: "error", submission, email, errors: {}, message: friendlyAuthError(error) };
  }
  return {
    step: "code",
    status: "sent",
    submission,
    email,
    errors: {},
    message: `We emailed a sign-in code to ${email}. It can take a minute to arrive.`,
  };
}

/** Step 2 of code sign-in: check the code, set the session, continue to ?next=. */
export async function verifySignInCode(prev: CodeFormState, fd: FormData): Promise<CodeFormState> {
  const submission = prev.submission + 1;
  const email = normalizeEmail(str(fd, "email"));
  const code = normalizeCode(str(fd, "code"));
  const next = safeNextPath(str(fd, "next"));

  const errors = validateCode(code);
  if (errors.code) {
    return { step: "code", status: "invalid", submission, email, errors, message: "Please fix the highlighted fields." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    return { step: "code", status: "error", submission, email, errors: {}, message: friendlyAuthError(error) };
  }
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUp(prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const submission = prev.submission + 1;
  const email = normalizeEmail(str(fd, "email"));
  const password = str(fd, "password");
  const confirm = str(fd, "confirm");

  const errors = validateSignUp(email, password, confirm);
  if (Object.keys(errors).length) {
    return { status: "invalid", submission, email, errors, message: "Please fix the highlighted fields." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/` },
  });
  if (error) {
    return { status: "error", submission, email, errors: {}, message: friendlyAuthError(error) };
  }
  if (data.session) {
    // Email confirmation is turned off in Supabase: already signed in.
    revalidatePath("/", "layout");
    redirect("/");
  }
  return {
    status: "sent",
    submission,
    email,
    errors: {},
    // Supabase returns this same response for an email that already has an
    // account (and sends nothing), so say what to do in that case too.
    message: `Almost there! We emailed a confirmation link to ${email}. Open it on this device to finish. Already have an account? Sign in instead.`,
  };
}

export async function requestPasswordReset(prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const submission = prev.submission + 1;
  const email = normalizeEmail(str(fd, "email"));
  const errors = validateSignIn(email, "x");
  if (errors.email) {
    return { status: "invalid", submission, email, errors: { email: errors.email }, message: "Please fix the highlighted fields." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password`,
  });
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) {
    return { status: "error", submission, email, errors: {}, message: friendlyAuthError(error) };
  }
  // Same message whether or not the account exists (don't reveal which emails are registered).
  return {
    status: "sent",
    submission,
    email,
    errors: {},
    message: `If ${email} has an account, a reset link is on its way. Open it on this device.`,
  };
}

export async function updatePassword(prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const submission = prev.submission + 1;
  const password = str(fd, "password");
  const confirm = str(fd, "confirm");
  const errors = validateNewPassword(password, confirm);
  if (Object.keys(errors).length) {
    return { status: "invalid", submission, email: "", errors, message: "Please fix the highlighted fields." };
  }

  // Only offered right after opening a reset link (see RESET_COOKIE for why
  // this is a UX guard; Supabase's "Secure password change" is the real gate).
  const cookieStore = await cookies();
  if (cookieStore.get(RESET_COOKIE)?.value !== "1") {
    return {
      status: "error",
      submission,
      email: "",
      errors: {},
      message: "For security, open the link from a new reset email to change your password.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { status: "error", submission, email: "", errors: {}, message: friendlyAuthError(error) };
  }
  cookieStore.delete(RESET_COOKIE);
  revalidatePath("/", "layout");
  redirect("/?password=updated");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // "local": sign out this browser only, so the phone stays signed in when
  // you sign out on the laptop.
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/");
}

/** One form, three buttons: send a code, check it, or start over with another email. */
export async function codeSignIn(prev: CodeFormState, fd: FormData): Promise<CodeFormState> {
  const intent = str(fd, "intent");
  if (intent === "verify") return verifySignInCode(prev, fd);
  if (intent === "restart") {
    return {
      step: "email",
      status: "idle",
      submission: prev.submission + 1,
      email: normalizeEmail(str(fd, "email")),
      name: str(fd, "name"),
      errors: {},
      message: null,
    };
  }
  if (str(fd, "token")) return requestJoinCode(prev, fd);
  return requestSignInCode(prev, fd);
}

/**
 * Joining by invite (migration 0019): claim_invite makes the new member
 * (their taster, a household of one, a connection to whoever invited them)
 * and allows their email to sign up; then we email them a code like any
 * sign-in. Their account only exists once they type the code, which proves
 * the email is theirs. Asking again (a typo, a lost email) moves the claim.
 */
export async function requestJoinCode(prev: CodeFormState, fd: FormData): Promise<CodeFormState> {
  const submission = prev.submission + 1;
  const token = str(fd, "token");
  const name = str(fd, "name").trim();
  const email = normalizeEmail(str(fd, "email"));
  const errors = { ...validateName(name), ...(validateSignIn(email, "x").email ? { email: "Enter a valid email address." } : {}) };
  if (Object.keys(errors).length) {
    return { step: "email", status: "invalid", submission, email, name, errors, message: "Please fix the highlighted fields." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: result, error } = await supabase.rpc("claim_invite", { p_token: token, p_name: name, p_email: email });
  const problem = error ? "Something went wrong. Please try again." : inviteProblem(String(result));
  if (problem) {
    return { step: "email", status: "error", submission, email, name, errors: {}, message: problem };
  }

  const { error: otpError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (otpError) {
    return { step: "email", status: "error", submission, email, name, errors: {}, message: friendlyAuthError(otpError) };
  }
  return {
    step: "code",
    status: "sent",
    submission,
    email,
    name,
    errors: {},
    message: `We emailed a code to ${email}. Type it here to finish joining. It can take a minute to arrive.`,
  };
}

/**
 * Settings: set (or change) a password, so you can sign in either way. The
 * emailed code keeps working too. Supabase's "Secure password change" may
 * ask for a recent sign-in first (friendlyAuthError says so).
 */
export async function setPassword(prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const submission = prev.submission + 1;
  const password = str(fd, "password");
  const confirm = str(fd, "confirm");
  const errors = validateNewPassword(password, confirm);
  if (Object.keys(errors).length) {
    return { status: "invalid", submission, email: "", errors, message: "Please fix the highlighted fields." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { status: "error", submission, email: "", errors: {}, message: friendlyAuthError(error) };
  }
  return { status: "sent", submission, email: "", errors: {}, message: "Password saved. You can sign in with it or with an emailed code." };
}
