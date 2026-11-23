"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { FormField } from "@/components/form-field";
import { initialCodeState } from "@/lib/auth/form-state";
import { codeSignIn } from "./actions";

/**
 * Sign in with a one-time code: enter your email, we email a code, type it
 * here. Works in whatever browser or home-screen app you started in.
 */
export function CodeSignInForm({ next, footer }: { next: string; footer?: ReactNode }) {
  const [state, formAction, pending] = useActionState(codeSignIn, initialCodeState);
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.submission === 0) return;
    const firstInvalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const codeField = state.step === "code" && state.status === "sent" ? formRef.current?.querySelector<HTMLElement>("#code") : null;
    (firstInvalid ?? codeField ?? messageRef.current)?.focus();
  }, [state.submission, state.step, state.status]);

  const isError = state.status === "invalid" || state.status === "error";
  const buttonClass = "rounded-full bg-teal-deep px-4 py-3 text-base font-bold text-white shadow-sm disabled:opacity-70";
  const linkButtonClass = "font-semibold text-teal underline-offset-2 hover:underline disabled:opacity-70";

  return (
    <form key={state.submission} ref={formRef} action={formAction} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />

      {state.message && (
        <p
          ref={messageRef}
          tabIndex={-1}
          role={isError ? "alert" : "status"}
          className={
            isError
              ? "rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm"
              : "rounded-2xl border border-teal/30 bg-card p-3 text-sm text-teal-deep shadow-sm"
          }
        >
          {state.message}
        </p>
      )}

      {state.step === "email" ? (
        <>
          <FormField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            defaultValue={state.email}
            error={state.errors.email}
          />
          <button type="submit" name="intent" value="send" disabled={pending} className={buttonClass}>
            {pending ? "Sending…" : "Email me a sign-in code"}
          </button>
        </>
      ) : (
        <>
          <input type="hidden" name="email" value={state.email} />
          <FormField
            id="code"
            label="Sign-in code"
            hint={`Sent to ${state.email}`}
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={12}
            error={state.errors.code}
          />
          <button type="submit" name="intent" value="verify" disabled={pending} className={buttonClass}>
            {pending ? "Checking…" : "Sign in"}
          </button>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            <button type="submit" name="intent" value="send" formNoValidate disabled={pending} className={linkButtonClass}>
              Send a new code
            </button>
            <button type="submit" name="intent" value="restart" formNoValidate disabled={pending} className={linkButtonClass}>
              Use a different email
            </button>
          </div>
        </>
      )}

      {footer}
    </form>
  );
}
