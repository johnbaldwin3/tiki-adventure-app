import type { Metadata } from "next";
import Link from "next/link";
import { AuthPage } from "@/components/auth-page";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { inviteProblem } from "@/lib/auth/validate";
import { APP_NAME } from "@/lib/collections";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { CodeSignInForm } from "../../auth/code-sign-in-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Join", robots: { index: false } };

const linkClass = "font-semibold text-teal underline-offset-2 hover:underline";

/** Opened from a personal invite link (migration 0019). Works signed out. */
export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const user = await getSignedInUser();
  if (user?.taster) {
    return (
      <AuthPage eyebrow={APP_NAME} title="You're already a member">
        <p className="text-sm text-ink-soft">
          You&apos;re signed in as {user.taster.displayName}.{" "}
          <Link href="/" className={linkClass}>
            Go to your list
          </Link>
          .
        </p>
      </AuthPage>
    );
  }

  let status = "unknown";
  let inviter: string | null = null;
  if (/^[A-Za-z0-9_-]{20,100}$/.test(token)) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("invite_preview", { p_token: token });
    const row = (Array.isArray(data) ? data[0] : data) as { status?: string; inviter?: string | null } | null;
    if (error) status = "error";
    else if (row?.status) {
      status = row.status;
      inviter = row.inviter ?? null;
    }
  }

  if (status !== "ok") {
    return (
      <AuthPage eyebrow={APP_NAME} title="Join">
        <p role="alert" className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm">
          {status === "error" ? "Couldn't check this invite right now. Please try again in a moment." : inviteProblem(status)}
        </p>
        <p className="text-center text-sm">
          Already a member?{" "}
          <Link href="/login" className={linkClass}>
            Sign in
          </Link>
        </p>
      </AuthPage>
    );
  }

  return (
    <AuthPage
      eyebrow={APP_NAME}
      title={inviter ? `${inviter} invited you` : "You're invited"}
      intro={`${APP_NAME} is a home bar app for friends & family: a tasting log, your bar, and a recipe library. Tell us your name and email, and we'll email you a code to finish. No password needed.`}
    >
      <CodeSignInForm
        next="/welcome"
        joinToken={token}
        footer={
          <p className="text-center text-sm">
            Already a member?{" "}
            <Link href="/login" className={linkClass}>
              Sign in
            </Link>
          </p>
        }
      />
    </AuthPage>
  );
}
