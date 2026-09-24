import type { Metadata } from "next";
import Link from "next/link";
import { fetchCocktailRecords } from "@/lib/cocktails";
import { cocktailsByIngredient, ingredientsByFamily } from "@/lib/ingredients";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ingredients" };

const familyAnchor = (family: string) => family.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default async function IngredientsPage() {
  let usage: Map<string, string[]> | null = null;
  try {
    const records = await fetchCocktailRecords();
    usage = cocktailsByIngredient(records.map((r) => ({ slug: r.slug, ingredientTexts: r.ingredientTexts })));
  } catch (err) {
    console.error("ingredients: failed to load usage counts", err);
  }
  const groups = ingredientsByFamily();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-8 pt-6 sm:max-w-lg">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 px-1 text-sm font-semibold text-teal underline-offset-2 hover:underline"
      >
        <span aria-hidden="true">←</span> All cocktails
      </Link>

      <header className="tiki-header relative overflow-hidden rounded-3xl px-5 py-6 text-white shadow-lg">
        <span aria-hidden="true" className="pointer-events-none absolute -right-4 -top-6 text-8xl opacity-20">
          🍍
        </span>
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Adventures in Tiki</p>
        <h1 className="relative mt-1 text-3xl font-extrabold tracking-tight">Ingredients</h1>
        <p className="relative mt-2 max-w-xs text-sm text-white/90">
          Every ingredient in the Top 100, by style, with example bottles to look for.
        </p>
      </header>

      {!usage && (
        <p role="alert" className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm">
          Couldn&apos;t load which drinks use each ingredient right now. The list below is still accurate.
        </p>
      )}

      <nav aria-label="Jump to a family" className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <a
            key={g.family}
            href={`#${familyAnchor(g.family)}`}
            className="rounded-full border border-teal/25 bg-card px-3 py-1.5 text-xs font-semibold text-teal-deep shadow-sm hover:bg-sand-deep"
          >
            {g.family}
          </a>
        ))}
      </nav>

      {groups.map((g) => (
        <section
          key={g.family}
          id={familyAnchor(g.family)}
          aria-labelledby={`${familyAnchor(g.family)}-heading`}
          className="flex scroll-mt-4 flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <h2 id={`${familyAnchor(g.family)}-heading`} className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              {g.family}
            </h2>
            <span aria-hidden="true" className="h-px flex-1 bg-teal/20" />
          </div>
          <ul className="flex flex-col divide-y divide-teal/10 overflow-hidden rounded-2xl bg-card shadow-sm">
            {g.items.map((i) => {
              const count = usage?.get(i.id)?.length;
              return (
                <li key={i.id}>
                  <Link
                    href={`/ingredients/${i.id}`}
                    prefetch={false}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-sand"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold text-ink">{i.name}</span>
                      {i.brands.length > 0 && (
                        <span className="truncate text-xs text-ink-faint">e.g. {i.brands.slice(0, 2).join(", ")}</span>
                      )}
                    </span>
                    {i.staple && (
                      <span className="shrink-0 rounded-full border border-teal/30 px-2 py-0.5 text-[11px] font-semibold text-teal-deep">
                        Staple
                      </span>
                    )}
                    {count !== undefined && (
                      <span className="shrink-0 text-xs text-ink-soft">
                        {count} {count === 1 ? "drink" : "drinks"}
                      </span>
                    )}
                    <span aria-hidden="true" className="text-lg leading-none text-ink-faint">
                      ›
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="pt-2 text-center text-xs text-ink-faint">
        Rum style examples from{" "}
        <a
          href="https://www.diffordsguide.com/beer-wine-spirits"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-teal underline underline-offset-2"
        >
          Difford&apos;s Guide<span className="sr-only"> (opens in a new tab)</span>
        </a>{" "}
        product listings.
      </p>
    </main>
  );
}
