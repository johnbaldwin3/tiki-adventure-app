import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { SuggestionCard } from "@/components/suggestion-card";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { fetchCabinet } from "@/lib/cabinet-data";
import { fetchCocktailRecords, type CocktailRecord } from "@/lib/cocktails";
import { suggestNext } from "@/lib/suggest";
import { rankCocktails } from "@/lib/tasting";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "What to try next" };

const SUGGESTION_COUNT = 10;

export default async function NextPage() {
  // The cabinet is only for signed-in tasters (RLS); null otherwise, and suggestions skip it.
  const [records, cabinet, user] = await Promise.all([
    fetchCocktailRecords().catch((err): CocktailRecord[] | null => {
      unstable_rethrow(err);
      console.error("next: failed to load", err);
      return null;
    }),
    fetchCabinet().catch((err) => {
      unstable_rethrow(err);
      console.error("next: failed to load cabinet", err);
      return null;
    }),
    getSignedInUser(),
  ]);

  const shell = { eyebrow: "Not tried yet", title: "What to try next", icon: "🧭" };
  if (!records) {
    return (
      <PageShell {...shell}>
        <p role="alert" className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm">
          Couldn&apos;t load suggestions right now. Please try refreshing the page.
        </p>
      </PageShell>
    );
  }

  const avgByName = new Map(rankCocktails(records).map((r) => [r.name, r.avgRating]));
  const suggestions = suggestNext(
    records.map((r) => ({ ...r, avgRating: avgByName.get(r.name) ?? null })),
    { have: cabinet ? new Set(cabinet.keys()) : null, limit: SUGGESTION_COUNT }
  );

  return (
    <PageShell
      {...shell}
      intro={
        cabinet
          ? "Drinks we haven't tried, ranked by what we've loved so far and what's in our bar."
          : "Drinks we haven't tried, ranked by what we've loved so far."
      }
    >
      {suggestions.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 text-center text-sm text-ink-soft shadow-sm">
          We&apos;ve tried them all! <span aria-hidden="true">🎉</span>
        </p>
      ) : (
        <ol aria-label="Suggestions" className="flex list-decimal flex-col gap-2 pl-6 marker:text-sm marker:font-bold marker:text-coral-deep">
          {suggestions.map((s) => (
            <li key={s.drink.slug}>
              <SuggestionCard s={s} />
            </li>
          ))}
        </ol>
      )}

      {!user && (
        <p className="text-xs text-ink-faint">
          <Link href="/login?next=%2Fnext" className="font-semibold text-teal underline underline-offset-2">
            Sign in
          </Link>{" "}
          to also weigh what&apos;s in our bar.
        </p>
      )}

      <details className="rounded-2xl bg-card p-4 text-sm shadow-sm">
        <summary className="cursor-pointer font-semibold text-teal">How this works</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-ink-soft">
          <li>
            Drinks that share ingredients with ones we rated above our average move up; ones like drinks we rated
            below it move down. Staples like fresh citrus don&apos;t count.
          </li>
          <li>
            When we&apos;re signed in, drinks our bar can make now get a boost (fresh citrus, water, soda, salt and
            Angostura are assumed on hand), and ones a single ingredient away a smaller one.
          </li>
          <li>Otherwise, Difford&apos;s ranking breaks ties (our own recipes come after the Top 100).</li>
        </ul>
      </details>
    </PageShell>
  );
}
