import Link from "next/link";
import type { ReactNode } from "react";

/** Shared shell for the sign-in / sign-up / password pages. */
export function AuthPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-8 pt-6 sm:max-w-lg">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 px-1 text-sm font-semibold text-teal underline-offset-2 hover:underline"
      >
        <span aria-hidden="true">←</span> All cocktails
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-teal-deep">{title}</h1>
        {intro && <p className="mt-2 text-sm text-ink-soft">{intro}</p>}
      </header>
      {children}
    </main>
  );
}
