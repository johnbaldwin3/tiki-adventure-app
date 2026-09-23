"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { FormField } from "@/components/form-field";
import { initialAuthState, type AuthFormState } from "@/lib/auth/form-state";

type FieldId = "email" | "password" | "confirm";

interface Field {
  id: FieldId;
  label: string;
  type: "email" | "password";
  autoComplete: string;
  hint?: string;
}

interface Props {
  action: (prev: AuthFormState, fd: FormData) => Promise<AuthFormState>;
  fields: Field[];
  submitLabel: string;
  pendingLabel: string;
  hidden?: Record<string, string>;
  footer?: ReactNode;
}

/** Shared sign-in / sign-up / password form with accessible errors and focus handling. */
export function AuthForm({ action, fields, submitLabel, pendingLabel, hidden, footer }: Props) {
  const [state, formAction, pending] = useActionState(action, initialAuthState);
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.submission === 0) return;
    const firstInvalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (firstInvalid ?? messageRef.current)?.focus();
  }, [state.submission]);

  if (state.status === "sent") {
    return (
      <p
        ref={messageRef}
        tabIndex={-1}
        role="status"
        className="rounded-2xl border border-teal/30 bg-card p-4 text-sm text-teal-deep shadow-sm"
      >
        {state.message}
      </p>
    );
  }

  return (
    <form key={state.submission} ref={formRef} action={formAction} noValidate className="flex flex-col gap-5">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {state.message && (
        <p
          ref={messageRef}
          tabIndex={-1}
          role="alert"
          className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm"
        >
          {state.message}
        </p>
      )}

      {fields.map((f) => (
        <FormField
          key={f.id}
          id={f.id}
          label={f.label}
          type={f.type}
          autoComplete={f.autoComplete}
          hint={f.hint}
          inputMode={f.type === "email" ? "email" : undefined}
          defaultValue={f.id === "email" ? state.email : undefined}
          error={state.errors[f.id]}
        />
      ))}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-teal-deep px-4 py-3 text-base font-bold text-white shadow-sm disabled:opacity-70"
      >
        {pending ? pendingLabel : submitLabel}
      </button>

      {footer}
    </form>
  );
}
