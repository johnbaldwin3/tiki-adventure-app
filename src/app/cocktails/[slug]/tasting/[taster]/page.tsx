import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCocktailBySlug } from "@/lib/cocktails";
import { SLUG_PATTERN } from "@/lib/slug";
import { tastingWritesEnabled, todayInEastern } from "@/lib/tasting-form";
import { TastingForm } from "./tasting-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit tasting · Adventures in Tiki",
  robots: { index: false },
};

export default async function EditTastingPage({
  params,
}: PageProps<"/cocktails/[slug]/tasting/[taster]">) {
  const { slug, taster } = await params;
  if (!SLUG_PATTERN.test(slug) || !/^[a-z]{2,3}$/.test(taster)) notFound();

  let cocktail: Awaited<ReturnType<typeof fetchCocktailBySlug>>;
  try {
    cocktail = await fetchCocktailBySlug(slug);
  } catch {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-8 pt-6 sm:max-w-lg">
        <p
          role="alert"
          className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm"
        >
          Couldn&apos;t load this tasting right now. Please try refreshing the page.
        </p>
      </main>
    );
  }
  const entry = cocktail?.tasters.find((t) => t.initials.toLowerCase() === taster);
  if (!cocktail || !entry) notFound();

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

      <TastingForm
        slug={slug}
        taster={taster}
        today={todayInEastern()}
        writesEnabled={tastingWritesEnabled(process.env)}
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
