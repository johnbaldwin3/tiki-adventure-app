import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth-page";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { safeNextPath } from "@/lib/auth/validate";
import { signIn } from "../auth/actions";
import { AuthForm } from "../auth/auth-form";
import { CodeSignInForm } from "../auth/code-sign-in-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const linkClass = "font-semibold text-teal underline-offset-2 hover:underline";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  if (await getSignedInUser()) redirect(next);
  // Default: a code by email (no password to remember). ?with=password keeps
  // the password form for anyone who has one.
  const withPassword = sp.with === "password";
  const switchHref = (password: boolean) => {
    const params = new URLSearchParams();
    if (password) params.set("with", "password");
    if (next !== "/") params.set("next", next);
    const qs = params.toString();
    return qs ? `/login?${qs}` : "/login";
  };

  return (
    <AuthPage
      eyebrow="Equal Parts"
      title="Sign in"
      intro={withPassword ? "Sign in with your email and password." : "We'll email you a short code. No password needed."}
    >
      {sp.error === "link" && (
        <p role="alert" className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm">
          That link has expired or was already used. Sign in below, or request a new link.
        </p>
      )}
      {withPassword ? (
        <AuthForm
          action={signIn}
          hidden={{ next }}
          submitLabel="Sign in"
          pendingLabel="Signing in…"
          fields={[
            { id: "email", label: "Email", type: "email", autoComplete: "email" },
            { id: "password", label: "Password", type: "password", autoComplete: "current-password" },
          ]}
          footer={
            <div className="flex flex-col gap-2 text-center text-sm">
              <Link href="/forgot-password" className={linkClass}>
                Forgot your password?
              </Link>
              <Link href={switchHref(false)} className={linkClass}>
                Email me a code instead
              </Link>
              <p className="text-ink-soft">
                First time here?{" "}
                <Link href="/signup" className={linkClass}>
                  Create your account
                </Link>
              </p>
            </div>
          }
        />
      ) : (
        <CodeSignInForm
          next={next}
          footer={
            <p className="text-center text-sm">
              <Link href={switchHref(true)} className={linkClass}>
                Use a password instead
              </Link>
            </p>
          }
        />
      )}
    </AuthPage>
  );
}
