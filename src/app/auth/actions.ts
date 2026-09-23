"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  friendlyAuthError,
  normalizeEmail,
  safeNextPath,
  validateNewPassword,
  validateSignIn,
  validateSignUp,
} from "@/lib/auth/validate";
import { RESET_COOKIE, type AuthFormState } from "@/lib/auth/form-state";

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

/**
 * This site's origin, for links in auth emails. Prefers a configured URL
 * (NEXT_PUBLIC_SITE_URL, else Vercel's production domain) over request
 * headers; Supabase additionally only honors allow-listed redirect URLs.
 */
async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

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
