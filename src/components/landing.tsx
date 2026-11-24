import Link from "next/link";
import { APP_NAME } from "@/lib/collections";

const FEATURES = [
  { icon: "🍹", title: "A tasting log", text: "Rate and note every drink you try, and see how your household's favorites stack up." },
  { icon: "🍾", title: "Your home bar", text: "Keep track of the bottles you have, what you can make tonight, and what to buy next." },
  { icon: "📖", title: "A recipe library", text: "Tiki and tropical classics, the IBA official cocktails, and your own recipes." },
  { icon: "🌺", title: "Friends & family", text: "Share ratings with the friends you invite. Everything else stays private to your household." },
];

/**
 * What a signed-out visitor sees instead of the app: what it is, and how to
 * sign in or join. No recipes or ratings (members only, migration 0018).
 */
export function Landing({ note }: { note?: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-8 pt-6 sm:max-w-lg">
      <header className="bar-header relative overflow-hidden rounded-3xl px-5 py-8 text-white shadow-lg">
        <span aria-hidden="true" className="pointer-events-none absolute -right-3 -top-5 text-8xl opacity-15">
          🍸
        </span>
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/80">A home bar app for friends &amp; family</p>
        <h1 className="relative mt-1 text-4xl font-extrabold tracking-tight">{APP_NAME}</h1>
        <p className="relative mt-3 max-w-xs text-sm text-white/90">
          Your cocktails, your bar and your tasting notes, in one place.
        </p>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Link href="/login" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-teal-deep shadow-sm hover:bg-sand">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
            Create your account
          </Link>
        </div>
      </header>

      {note && (
        <p role="status" className="rounded-2xl border border-teal/30 bg-card p-3 text-sm text-teal-deep shadow-sm">
          {note}
        </p>
      )}

      <section aria-labelledby="about-heading" className="flex flex-col gap-3">
        <h2 id="about-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          What&apos;s inside
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-2xl border border-teal/15 bg-card p-4 shadow-sm">
              <p aria-hidden="true" className="text-2xl leading-none">
                {f.icon}
              </p>
              <h3 className="mt-2 font-bold text-teal-deep">{f.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="rounded-2xl bg-sand-deep p-4 text-sm text-ink">
        <strong>{APP_NAME} is invite-only.</strong> If someone invited you, open the invite link they sent you to join.
        Already a member? Sign in with a code we email you, or with your password.
      </p>
    </main>
  );
}
