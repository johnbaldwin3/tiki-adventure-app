import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PageShell } from "@/components/page-shell";
import { SubmitButton } from "@/components/submit-button";
import Link from "next/link";
import { hideWelcome, showWelcome } from "./actions";
import { GUIDE_HELP, GUIDE_SECTIONS } from "./sections";
import { isWelcomeHidden, WELCOME_COOKIE } from "@/lib/welcome";

export const metadata: Metadata = { title: "How Equal Parts works" };

export default async function GuidePage({ searchParams }: PageProps<"/guide">) {
  const sp = await searchParams;
  const hidden = isWelcomeHidden((await cookies()).get(WELCOME_COOKIE)?.value);

  return (
    <PageShell
      eyebrow="Quick guide"
      title="How Equal Parts works"
      icon="🗺️"
      intro="A recipe book, tasting log and home-bar tracker in one. Here's everything it does, in two minutes."
    >
      <nav aria-labelledby="jump-heading" className="rounded-2xl border border-teal/15 bg-card p-4 shadow-sm">
        <h2 id="jump-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          Jump to
        </h2>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {GUIDE_SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex min-h-8 items-center rounded-full border border-teal/30 px-3 text-xs font-semibold text-teal-deep hover:bg-sand-deep"
              >
                <span aria-hidden="true">{s.icon}&nbsp;</span>
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {GUIDE_SECTIONS.map((s) => (
        <section
          key={s.id}
          id={s.id}
          aria-labelledby={`${s.id}-heading`}
          className="scroll-mt-4 rounded-2xl border border-teal/15 bg-card p-4 shadow-sm"
        >
          <h2 id={`${s.id}-heading`} className="flex items-center gap-2 text-lg font-bold text-teal-deep">
            <span aria-hidden="true">{s.icon}</span>
            {s.title}
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">{s.summary}</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink marker:text-teal">
            {s.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
          {s.link && (
            <p className="mt-3 text-right">
              <Link href={s.link.href} className="text-sm font-semibold text-teal underline-offset-2 hover:underline">
                {s.link.label} <span aria-hidden="true">→</span>
              </Link>
            </p>
          )}
        </section>
      ))}

      <section
        id="welcome-card"
        aria-labelledby="welcome-setting-heading"
        className="scroll-mt-4 rounded-2xl border border-teal/30 bg-sand-deep p-4 text-sm shadow-sm"
      >
        <h2 id="welcome-setting-heading" className="font-bold text-teal-deep">
          The welcome card
        </h2>
        {sp.welcome === "shown" && (
          <p role="status" className="mt-1 font-semibold text-teal-deep">
            Done: it&apos;s back on the home page.
          </p>
        )}
        <p className="mt-1 text-ink">
          {hidden
            ? "You've hidden the “New here?” card on the home page. Want it back?"
            : "When you're signed in, the home page shows a “New here?” card that links here."}{" "}
          This guide is always under <strong className="font-semibold">Help</strong> at the top of every page.
        </p>
        <form action={hidden ? showWelcome : hideWelcome} className="mt-2">
          <SubmitButton
            pendingText="Saving…"
            className="min-h-10 rounded-full border border-teal/40 bg-card px-4 font-semibold text-teal-deep hover:bg-sand"
          >
            {hidden ? "Show it again" : "Hide the welcome card"}
          </SubmitButton>
        </form>
      </section>

      <p className="px-1 text-sm text-ink-soft">{GUIDE_HELP}</p>
    </PageShell>
  );
}
