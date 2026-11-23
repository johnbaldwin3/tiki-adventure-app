import Link from "next/link";
import { hideWelcome } from "@/app/guide/actions";
import { SubmitButton } from "@/components/submit-button";

/** Home page card for signed-in people who haven't hidden it: points at the guide. */
export function WelcomeCard({ name }: { name?: string }) {
  return (
    <section aria-labelledby="welcome-heading" className="rounded-2xl border border-teal/30 bg-card p-4 text-sm shadow-sm">
      <h2 id="welcome-heading" className="text-base font-bold text-teal-deep">
        <span aria-hidden="true">👋 </span>
        {name ? `Welcome, ${name}!` : "Welcome!"} New here?
      </h2>
      <p className="mt-1 text-ink">
        Equal Parts is a cocktail recipe book, tasting log and home-bar tracker in one. The quick guide shows what
        everything does in about two minutes.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href="/guide"
          className="inline-flex min-h-10 items-center rounded-full bg-teal px-4 font-semibold text-white shadow-sm hover:bg-teal-deep"
        >
          How Equal Parts works <span aria-hidden="true">&nbsp;→</span>
        </Link>
        <form action={hideWelcome}>
          <SubmitButton pendingText="Hiding…" className="min-h-10 px-1 font-semibold text-teal underline-offset-2 hover:underline">
            Hide this
          </SubmitButton>
        </form>
      </div>
      <p className="mt-2 text-xs text-ink-soft">You can always find the guide under “Help” at the top of every page.</p>
    </section>
  );
}
