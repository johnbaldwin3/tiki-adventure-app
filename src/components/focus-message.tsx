"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A status/alert message shown after a form action redirects back. The
 * control that was used is often gone by then (e.g. "Got it" removes its
 * row), so focus moves here: screen readers read it, and keyboard users
 * carry on from a sensible spot.
 */
export function FocusMessage({
  role,
  className,
  children,
}: {
  role: "status" | "alert";
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <p ref={ref} tabIndex={-1} role={role} className={`${className} outline-offset-2`}>
      {children}
    </p>
  );
}
