import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCocktailRecords, type CocktailRecord } from "@/lib/cocktails";
import { aliasesFor, getIngredient, resolveIngredient } from "@/lib/ingredients";
import { totalWineSearchUrl, WINEXPRESS } from "@/lib/stores";
import { rankCocktails } from "@/lib/tasting";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/ingredients/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ingredient = getIngredient(id);
  return { title: ingredient ? ingredient.name : "Ingredient not found" };
}

/** What to say when a style has no example bottles. */
function noBrandsNote(family: string): string {
  if (family === "Syrups") return "Easy to make at home — no particular brand needed.";
  if (["Juices & purées", "Mixers", "Other", "Wine, sherry & port"].includes(family)) {
    return "No particular brand needed — any good one works.";
  }
  return "Hard to find — check the original Difford's recipe for guidance.";
}

export default async function IngredientPage({ params }: PageProps<"/ingredients/[id]">) {
  const { id } = await params;
  const ingredient = getIngredient(id);
  if (!ingredient) notFound();

  let drinks: (CocktailRecord & { avgRating: number | null; optionalOnly: boolean })[] | null = null;
  try {
    const records = await fetchCocktailRecords();
    const avgByName = new Map(rankCocktails(records).map((r) => [r.name, r.avgRating]));
    drinks = records
      .map((r) => {
        const lines = r.ingredientTexts.map(resolveIngredient).filter((x) => x?.ingredient.id === id);
        return lines.length === 0
          ? null
          : { ...r, avgRating: avgByName.get(r.name) ?? null, optionalOnly: lines.every((l) => l!.optional) };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => a.diffordsRank - b.diffordsRank);
  } catch (err) {
    console.error("ingredient page: failed to load drinks", id, err);
  }
  const aliases = aliasesFor(id);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-8 pt-6 sm:max-w-lg">
      <Link
        href="/ingredients"
        className="inline-flex w-fit items-center gap-1 px-1 text-sm font-semibold text-teal underline-offset-2 hover:underline"
      >
        <span aria-hidden="true">←</span> All ingredients
      </Link>

      <header className="tiki-header relative overflow-hidden rounded-3xl px-5 py-6 text-white shadow-lg">
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/80">{ingredient.family}</p>
        <h1 className="relative mt-1 text-3xl font-extrabold tracking-tight">{ingredient.name}</h1>
        {ingredient.staple && (
          <p className="relative mt-3 w-fit rounded-full bg-white px-3 py-1 text-sm font-bold text-teal-deep">
            Staple: assumed always on hand
          </p>
        )}
      </header>

      {ingredient.description && (
        <p className="rounded-2xl bg-card p-4 text-sm leading-relaxed text-ink shadow-sm">{ingredient.description}</p>
      )}

      <section aria-labelledby="brands-heading" className="rounded-2xl bg-card p-4 shadow-sm">
        <h2 id="brands-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          Bottles to look for
        </h2>
        {ingredient.brands.length > 0 ? (
          <>
          <ul className="mt-2 flex flex-col divide-y divide-teal/10">
            {ingredient.brands.map((b) => (
              <li key={b} className="flex items-center gap-3 py-2 text-sm text-ink">
                <span className="min-w-0 flex-1">{b}</span>
                <a
                  href={totalWineSearchUrl(b)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Search Total Wine for ${b} (opens in a new tab)`}
                  className="shrink-0 rounded-full border border-teal/30 px-2.5 py-1 text-xs font-semibold text-teal-deep hover:bg-sand-deep"
                >
                  Total Wine <span aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-faint">
            Total Wine shows stock for the store you&apos;ve picked on their site. Not online? Call{" "}
            <a href={WINEXPRESS.phoneHref} className="font-semibold text-teal underline underline-offset-2">
              {WINEXPRESS.name} at {WINEXPRESS.phoneDisplay}
            </a>
            .
          </p>
          </>
        ) : (
          <p className="mt-2 text-sm italic text-ink-faint">{noBrandsNote(ingredient.family)}</p>
        )}
        {ingredient.brandsSource && (
          <p className="mt-3 text-xs text-ink-faint">
            Examples from{" "}
            <a
              href={ingredient.brandsSource}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-teal underline underline-offset-2"
            >
              Difford&apos;s Guide&apos;s list for this exact style<span className="sr-only"> (opens in a new tab)</span>
            </a>
            .
          </p>
        )}
      </section>

      <section aria-labelledby="drinks-heading" className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h2 id="drinks-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            {drinks ? `Used in ${drinks.length} ${drinks.length === 1 ? "drink" : "drinks"}` : "Used in"}
          </h2>
          <span aria-hidden="true" className="h-px flex-1 bg-teal/20" />
        </div>
        {!drinks ? (
          <p role="alert" className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm">
            Couldn&apos;t load the drinks right now. Please try refreshing the page.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {drinks.map((d) => (
              <li key={d.slug}>
                <Link
                  href={`/cocktails/${d.slug}`}
                  prefetch={false}
                  className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm hover:shadow-md"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-teal/30 bg-sand text-xs font-bold text-teal-deep">
                    <span className="sr-only">Difford&apos;s rank </span>
                    {d.diffordsRank}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold text-ink">{d.name}</span>
                    {d.optionalOnly && <span className="text-xs text-ink-faint">Optional in this recipe</span>}
                  </span>
                  {d.avgRating !== null ? (
                    <span className="rounded-full bg-teal-deep px-2.5 py-1 text-xs font-bold text-white">
                      <span className="sr-only">Average rating </span>
                      {d.avgRating}
                    </span>
                  ) : d.tried ? (
                    <span className="rounded-full border border-teal/30 px-2.5 py-1 text-xs font-semibold text-teal-deep">Tried</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="rounded-2xl bg-card p-4 text-sm shadow-sm">
        <summary className="cursor-pointer font-semibold text-teal">Written in the recipes as ({aliases.length})</summary>
        <ul className="mt-2 flex flex-col gap-1 text-ink-soft">
          {aliases.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </details>
    </main>
  );
}
