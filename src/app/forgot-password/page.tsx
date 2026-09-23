import type { Metadata } from "next";
import Link from "next/link";
import { AuthPage } from "@/components/auth-page";
import { requestPasswordReset } from "../auth/actions";
import { AuthForm } from "../auth/auth-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reset password · Adventures in Tiki", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthPage eyebrow="Account" title="Reset your password" intro="We'll email you a link to choose a new one.">
      <AuthForm
        action={requestPasswordReset}
        submitLabel="Send reset link"
        pendingLabel="Sending…"
        fields={[{ id: "email", label: "Email", type: "email", autoComplete: "email" }]}
        footer={
          <Link href="/login" className="text-center text-sm font-semibold text-teal underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        }
      />
    </AuthPage>
  );
}
