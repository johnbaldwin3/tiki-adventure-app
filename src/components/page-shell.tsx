import Link from "next/link";
import type { ReactNode } from "react";

/** Standard page frame: back link + header banner. */
export function PageShell({
  back = { href: "/", label: "All cocktails" },
  eyebrow,
  title,
  intro,
  icon,
  children,
}: {
  back?: { href: string; label: string };
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-8 pt-6 sm:max-w-lg">
      <Link
        href={back.href}
        className="inline-flex w-fit items-center gap-1 px-1 text-sm font-semibold text-teal underline-offset-2 hover:underline"
      >
        <span aria-hidden="true">←</span> {back.label}
      </Link>
      <header className="bar-header relative overflow-hidden rounded-3xl px-5 py-6 text-white shadow-lg">
        {icon && (
          <span aria-hidden="true" className="pointer-events-none absolute -right-4 -top-6 text-8xl opacity-20">
            {icon}
          </span>
        )}
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/80">{eyebrow}</p>
        <h1 className="relative mt-1 text-3xl font-extrabold tracking-tight">{title}</h1>
        {intro && <p className="relative mt-2 max-w-xs text-sm text-white/90">{intro}</p>}
      </header>
      {children}
    </main>
  );
}

export function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h2 id={id} className="text-sm font-bold uppercase tracking-wide text-ink-soft">
        {children}
      </h2>
      <span aria-hidden="true" className="h-px flex-1 bg-teal/20" />
    </div>
  );
}
