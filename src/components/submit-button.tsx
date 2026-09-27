"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** A submit button that's disabled while its form is sending (no double taps). */
export function SubmitButton({ children, pendingText, className }: { children: ReactNode; pendingText: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-70`}>
      {pending ? pendingText : children}
    </button>
  );
}
