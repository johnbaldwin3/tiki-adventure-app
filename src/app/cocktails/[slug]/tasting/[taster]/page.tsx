import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { fetchCocktailBySlug } from "@/lib/cocktails";
import { SLUG_PATTERN } from "@/lib/slug";
import { todayInEastern } from "@/lib/tasting-form";
import { TastingForm } from "./tasting-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/cocktails/[slug]/tasting/[taster]">): Promise<Metadata> {
  const { taster } = await params;
  return { title: `Edit ${taster.toUpperCase()}'s tasting`, robots: { index: false } };
}

/** Shared shell so every state of this page has a way back and a heading. */
function Shell({ slug, name, children }: { slug: string; name?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-8 pt-6 sm:max-w-lg">
      <Link
        href={name ? `/cocktails/${slug}#tasting` : "/"}
        className="inline-flex w-fit items-center gap-1 px-1 text-sm font-semibold text-teal underline-offset-2 hover:underline"
      >
        <span aria-hidden="true">←</span> {name ? `Back to ${name}` : "All cocktails"}
      </Link>
      {children}
    </main>
  );
}

export default async function EditTastingPage({
  params,
}: PageProps<"/cocktails/[slug]/tasting/[taster]">) {
  const { slug, taster } = await params;
  if (!SLUG_PATTERN.test(slug) || !/^[a-z]{2,3}$/.test(taster)) notFound();

  const user = await getSignedInUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/cocktails/${slug}/tasting/${taster}`)}`);

  let cocktail: Awaited<ReturnType<typeof fetchCocktailBySlug>>;
  try {
    cocktail = await fetchCocktailBySlug(slug);
  } catch (err) {
    console.error("edit tasting: failed to load", slug, err);
    return (
      <Shell slug={slug}>
        <h1 className="text-2xl font-extrabold text-teal-deep">Edit tasting</h1>
        <p
          role="alert"
          className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm"
        >
          Couldn&apos;t load this tasting right now. Please try refreshing the page.
        </p>
      </Shell>
    );
  }
  const entry = cocktail?.tasters.find((t) => t.initials.toLowerCase() === taster);
  if (!cocktail || !entry) notFound();

  const mine = user.taster?.initials.toLowerCase();
  if (!mine) {
    return (
      <Shell slug={slug} name={cocktail.name}>
        <h1 className="text-2xl font-extrabold text-teal-deep">Not a taster</h1>
        <p className="text-sm text-ink-soft">
          You&apos;re signed in as {user.email}, which isn&apos;t linked to a taster, so there&apos;s nothing to edit.
        </p>
      </Shell>
    );
  }
  const forOther = mine !== taster;
  const others = cocktail.tasters.filter((t) => t.initials.toLowerCase() !== taster);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-8 pt-6 sm:max-w-lg">
      <Link
        href={`/cocktails/${slug}#tasting`}
        className="inline-flex w-fit items-center gap-1 px-1 text-sm font-semibold text-teal underline-offset-2 hover:underline"
      >
        <span aria-hidden="true">←</span> Back to {cocktail.name}
      </Link>

      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
          {entry.displayName}&apos;s tasting
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-teal-deep">
          {cocktail.name}
        </h1>
      </header>

      {forOther && (
        <p className="rounded-2xl border border-teal/30 bg-sand-deep p-3 text-sm text-teal-deep">
          You&apos;re entering <strong>{entry.displayName}&apos;s</strong> rating &amp; notes. Their card will say you entered it.
        </p>
      )}

      <TastingForm
        slug={slug}
        taster={taster}
        today={todayInEastern()}
        whose={forOther ? entry.displayName : null}
        others={others.filter((t) => !t.tried).map((t) => t.displayName)}
        initialValues={{
          tried: entry.tried,
          rating: entry.rating === null ? "" : String(entry.rating),
          tastedAt: entry.tastedAt ?? "",
          notes: entry.notes ?? "",
        }}
      />
    </main>
  );
}
