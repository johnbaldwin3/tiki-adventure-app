import type { Metadata } from "next";
import Link from "next/link";
import { AuthPage } from "@/components/auth-page";
import { cookies } from "next/headers";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { RESET_COOKIE } from "@/lib/auth/form-state";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validate";
import { updatePassword } from "../auth/actions";
import { AuthForm } from "../auth/auth-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose a new password · Adventures in Tiki", robots: { index: false } };

// Reached from the reset email: /auth/confirm signs the user in, then sends them here.
export default async function ResetPasswordPage() {
  const user = await getSignedInUser();
  const fromResetLink = (await cookies()).get(RESET_COOKIE)?.value === "1";
  return (
    <AuthPage eyebrow="Account" title="Choose a new password">
      {user && fromResetLink ? (
        <AuthForm
          action={updatePassword}
          submitLabel="Save new password"
          pendingLabel="Saving…"
          fields={[
            {
              id: "password",
              label: "New password",
              type: "password",
              autoComplete: "new-password",
              hint: `At least ${PASSWORD_MIN_LENGTH} characters.`,
            },
            { id: "confirm", label: "Confirm new password", type: "password", autoComplete: "new-password" },
          ]}
        />
      ) : (
        <p className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm">
          This page needs the link from your reset email.{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            Send a new link
          </Link>
          .
        </p>
      )}
    </AuthPage>
  );
}
