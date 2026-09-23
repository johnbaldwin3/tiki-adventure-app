"use client";

import Link from "next/link";
import { useEffect } from "react";

// Last-resort boundary for unexpected render errors. Data-loading failures
// are already handled in-page with a friendly banner; this catches the rest.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 pb-8 pt-16 text-center sm:max-w-lg">
      <p aria-hidden="true" className="text-5xl">🍹</p>
      <h1 className="text-2xl font-extrabold text-teal-deep">Something spilled</h1>
      <p role="alert" className="text-sm text-ink-soft">
        This page hit an unexpected error. Try again, or head back to the list.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-teal-deep px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          Try again
        </button>
        <Link href="/" className="rounded-full border border-teal/30 bg-card px-4 py-2 text-sm font-semibold text-teal-deep shadow-sm">
          All cocktails
        </Link>
      </div>
    </main>
  );
}
