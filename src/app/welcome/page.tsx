import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPeople } from "@/lib/people-data";
import { APP_NAME } from "@/lib/collections";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Welcome" };

const STEPS = [
  { icon: "🍹", title: "Rate what you drink", text: "Open any recipe and add your rating and notes. Your list ranks drinks by your own ratings." },
  { icon: "🍾", title: "Tell us what's in your bar", text: "Tick off the bottles you have, and we'll show what you can make tonight and what to buy next." },
  { icon: "🌺", title: "Compare with friends", text: "You can see the ratings of whoever invited you (and they can see yours). Invite your own friends from Settings." },
];

/** The first screen after joining by invite. */
export default async function WelcomePage() {
  const people = await getPeople();
  if (!people.me) redirect("/");
  const inviter = people.friends[0]?.displayName;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-8 pt-6 sm:max-w-lg">
      <header className="bar-header relative overflow-hidden rounded-3xl px-5 py-7 text-white shadow-lg">
        <span aria-hidden="true" className="pointer-events-none absolute -right-3 -top-5 text-8xl opacity-15">
          🌴
        </span>
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Welcome to {APP_NAME}</p>
        <h1 className="relative mt-1 text-3xl font-extrabold tracking-tight">Hi, {people.me.displayName}!</h1>
        <p className="relative mt-2 max-w-xs text-sm text-white/90">
          {inviter ? `You're connected with ${inviter}. ` : ""}Here&apos;s how it works.
        </p>
      </header>
      <ol className="flex flex-col gap-3">
        {STEPS.map((s) => (
          <li key={s.title} className="flex gap-3 rounded-2xl border border-teal/15 bg-card p-4 shadow-sm">
            <span aria-hidden="true" className="text-2xl leading-none">
              {s.icon}
            </span>
            <div>
              <h2 className="font-bold text-teal-deep">{s.title}</h2>
              <p className="mt-1 text-sm text-ink-soft">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className="rounded-full bg-teal-deep px-4 py-2.5 text-sm font-bold text-white shadow-sm">
          Start exploring
        </Link>
        <Link href="/cabinet/edit" className="rounded-full border border-teal/30 px-4 py-2.5 text-sm font-semibold text-teal-deep">
          Set up my bar
        </Link>
        <Link href="/guide" className="rounded-full px-2 py-2.5 text-sm font-semibold text-teal underline-offset-2 hover:underline">
          How everything works <span aria-hidden="true">→</span>
        </Link>
      </div>
    </main>
  );
}
