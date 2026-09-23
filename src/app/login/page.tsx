import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth-page";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { safeNextPath } from "@/lib/auth/validate";
import { signIn } from "../auth/actions";
import { AuthForm } from "../auth/auth-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in · Adventures in Tiki", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  if (await getSignedInUser()) redirect(next);

  return (
    <AuthPage eyebrow="JB & GM only" title="Sign in" intro="Sign in to add your ratings and notes.">
      {sp.error === "link" && (
        <p role="alert" className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm">
          That link has expired or was already used. Sign in below, or request a new link.
        </p>
      )}
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
            <Link href="/forgot-password" className="font-semibold text-teal underline-offset-2 hover:underline">
              Forgot your password?
            </Link>
            <p className="text-ink-soft">
              First time here?{" "}
              <Link href="/signup" className="font-semibold text-teal underline-offset-2 hover:underline">
                Create your account
              </Link>
            </p>
          </div>
        }
      />
    </AuthPage>
  );
}
