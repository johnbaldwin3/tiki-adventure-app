import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { PageShell, SectionHeading } from "@/components/page-shell";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { summarizeCabinet } from "@/lib/cabinet";
import { fetchCabinet, type Cabinet } from "@/lib/cabinet-data";
import { fetchCocktailRecords, type CocktailRecord } from "@/lib/cocktails";
import { getIngredient } from "@/lib/ingredients";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Our bar",
  robots: { index: false },
};

const card = "rounded-2xl bg-card p-4 shadow-sm";

function DrinkLinks({ drinks }: { drinks: CocktailRecord[] }) {
  return (
    <>
      {drinks.map((d, i) => (
        <span key={d.slug}>
          {i > 0 && ", "}
          <Link
            href={`/cocktails/${d.slug}`}
            prefetch={false}
            className="font-semibold text-teal underline-offset-2 hover:underline"
          >
            {d.name}
          </Link>
        </span>
      ))}
    </>
  );
}

export default async function CabinetPage({
  searchParams,
}: PageProps<"/cabinet">) {
  const sp = await searchParams;
  const user = await getSignedInUser();

  if (!user) {
    return (
      <PageShell
        eyebrow="JB & GM only"
        title="Our bar"
        icon="🍾"
        intro="What's on our shelf, what we can make tonight, and what to buy next."
      >
        <p className={`${card} text-sm text-ink-soft`}>
          <Link
            href="/login?next=%2Fcabinet"
            className="font-semibold text-teal underline underline-offset-2"
          >
            Sign in
          </Link>{" "}
          to see and update our bar.
        </p>
      </PageShell>
    );
  }
  if (!user.taster && !user.lookupFailed) {
    return (
      <PageShell eyebrow="JB & GM only" title="Our bar" icon="🍾">
        <p className={`${card} text-sm text-ink-soft`}>
          You&apos;re signed in as {user.email}, which isn&apos;t linked to a
          taster, so the bar isn&apos;t available.
        </p>
      </PageShell>
    );
  }

  let cabinet: Cabinet | null = null;
  let records: CocktailRecord[] | null = null;
  if (user.taster) {
    try {
      [cabinet, records] = await Promise.all([
        fetchCabinet(),
        fetchCocktailRecords(),
      ]);
    } catch (err) {
      unstable_rethrow(err);
      console.error("cabinet: failed to load", err);
    }
  }

  if (!cabinet || !records) {
    return (
      <PageShell eyebrow="JB & GM's home bar" title="Our bar" icon="🍾">
        <p
          role="alert"
          className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm"
        >
          Couldn&apos;t load our bar right now. Please try refreshing the page.
        </p>
      </PageShell>
    );
  }

  const summary = summarizeCabinet(records, new Set(cabinet.keys()));
  const name = (id: string) => getIngredient(id)?.name ?? id;

  return (
    <PageShell
      eyebrow="JB & GM's home bar"
      title="Our bar"
      icon="🍾"
      intro={`${cabinet.size} ${cabinet.size === 1 ? "ingredient" : "ingredients"} on the shelf · ${summary.ready.length} ${summary.ready.length === 1 ? "drink" : "drinks"} ready to make`}
    >
      {sp.saved === "1" && (
        <p
          role="status"
          className="rounded-2xl border border-teal/30 bg-card p-3 text-sm text-teal-deep shadow-sm"
        >
          Our bar is saved.
        </p>
      )}

      <Link
        href="/cabinet/edit"
        className="w-fit rounded-full bg-teal-deep px-4 py-2.5 text-sm font-bold text-white shadow-sm"
      >
        {cabinet.size === 0 ? "Add what we have" : "Edit our bar"}
      </Link>

      <section aria-labelledby="ready-heading" className="flex flex-col gap-2">
        <SectionHeading id="ready-heading">
          Ready to make ({summary.ready.length})
        </SectionHeading>
        {summary.ready.length === 0 ? (
          <p className={`${card} text-sm italic text-ink-faint`}>
            {cabinet.size === 0
              ? "Nothing yet — add what we have, and this fills in. Fresh citrus, water, soda, salt and Angostura are assumed on hand."
              : summary.buyNext.length > 0
                ? "Nothing complete yet — see Buy next below."
                : "Nothing complete yet — add a few more ingredients."}
          </p>
        ) : (
          <ul aria-label="Ready to make" className="flex flex-col gap-2">
            {summary.ready.map((d) => (
              <li key={d.slug}>
                <Link
                  href={`/cocktails/${d.slug}`}
                  prefetch={false}
                  className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm hover:shadow-md"
                >
                  <span aria-hidden="true">🍹</span>
                  <span className="flex-1 text-sm font-semibold text-ink">
                    {d.name}
                  </span>
                  {!d.tried && (
                    <span className="rounded-full border border-coral/40 px-2 py-0.5 text-[11px] font-semibold text-coral-deep">
                      Not tried yet
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.buyNext.length > 0 && (
        <section aria-labelledby="buy-heading" className="flex flex-col gap-2">
          <SectionHeading id="buy-heading">Buy next</SectionHeading>
          <p className="text-xs text-ink-faint">
            One ingredient away: each of these would complete the drinks listed.
          </p>
          <ul className="flex flex-col gap-2">
            {summary.buyNext.map((b) => (
              <li key={b.ingredientId} className={card}>
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/ingredients/${b.ingredientId}`}
                    prefetch={false}
                    className="text-sm font-bold text-teal-deep underline-offset-2 hover:underline"
                  >
                    {name(b.ingredientId)}
                  </Link>
                  <span className="shrink-0 text-xs font-semibold text-ink-soft">
                    +{b.unlocks.length}{" "}
                    {b.unlocks.length === 1 ? "drink" : "drinks"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  <DrinkLinks drinks={b.unlocks} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cabinet.size > 0 && (
        <section
          aria-labelledby="shelf-heading"
          className="flex flex-col gap-2"
        >
          <SectionHeading id="shelf-heading">On the shelf</SectionHeading>
          <ul className={`${card} flex flex-col divide-y divide-teal/10 py-1`}>
            {[...cabinet.entries()]
              .sort((a, b) => name(a[0]).localeCompare(name(b[0])))
              .map(([id, bottle]) => (
                <li
                  key={id}
                  className="flex items-baseline justify-between gap-3 py-2 text-sm"
                >
                  <Link
                    href={`/ingredients/${id}`}
                    prefetch={false}
                    className="text-ink underline-offset-2 hover:underline"
                  >
                    {name(id)}
                  </Link>
                  {bottle && (
                    <span className="text-right text-xs text-ink-soft">
                      {bottle}
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
