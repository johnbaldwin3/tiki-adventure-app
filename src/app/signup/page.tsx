import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth-page";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validate";
import { signUp } from "../auth/actions";
import { AuthForm } from "../auth/auth-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function SignUpPage() {
  if (await getSignedInUser()) redirect("/");
  return (
    <AuthPage
      eyebrow="JB & GM only"
      title="Create your account"
      intro="Only emails on the tasters list can sign up. You'll get an email to confirm it's you."
    >
      <AuthForm
        action={signUp}
        submitLabel="Create account"
        pendingLabel="Creating…"
        fields={[
          { id: "email", label: "Email", type: "email", autoComplete: "email" },
          {
            id: "password",
            label: "Password",
            type: "password",
            autoComplete: "new-password",
            hint: `At least ${PASSWORD_MIN_LENGTH} characters.`,
          },
          { id: "confirm", label: "Confirm password", type: "password", autoComplete: "new-password" },
        ]}
        footer={
          <p className="text-center text-sm text-ink-soft">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-teal underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
        }
      />
    </AuthPage>
  );
}
