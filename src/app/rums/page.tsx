import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { FocusMessage } from "@/components/focus-message";
import { RumBadge } from "@/components/rum-badge";
import { RumChecker } from "@/components/rum-checker";
import { SubmitButton } from "@/components/submit-button";
import { SC_CATEGORIES, SC_GROUPS, SC_SOURCE, SC_STYLE_MAP } from "@/data/smugglers-cove";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { getIngredient } from "@/lib/ingredients";
import { fetchBarRums } from "@/lib/rum-bar-data";
import { barRumCategory, searchBottles } from "@/lib/rum-numbers";
import { labelBarRum } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rum numbers" };

const LABELED: Record<string, { role: "status" | "alert"; text: string }> = {
  saved: { role: "status", text: "Saved — that bottle now shows its number in our bar." },
  cleared: { role: "status", text: "Label cleared — the number comes from the book or the style again." },
  missing: { role: "alert", text: "That rum isn't in our bar any more." },
  error: { role: "alert", text: "Couldn't save that. Please try again." },
};

const BASIS_TEXT = {
  saved: "our label",
  "saved-ai": "our label, from the rum checker's best guess",
  book: "in the book's list",
  style: "its style (the book doesn't list the bottle, or we haven't named it)",
} as const;

export default async function RumsPage({ searchParams }: PageProps<"/rums">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 120) : "";
  const labeled = typeof sp.labeled === "string" ? LABELED[sp.labeled] : undefined;
  const user = await getSignedInUser().catch((err) => {
    unstable_rethrow(err);
    return null;
  });
  const barRums = user?.taster
    ? await fetchBarRums().catch((err) => {
        console.error("rums: failed to load our bar", err);
        return null;
      })
    : null;
  const hits = q ? searchBottles(q) : [];
  const stylesByCategory = new Map<string, string[]>();
  for (const [style, m] of Object.entries(SC_STYLE_MAP)) {
    stylesByCategory.set(m.category, [...(stylesByCategory.get(m.category) ?? []), style]);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-8 pt-6 sm:max-w-lg">
      <Link href="/" className="inline-flex w-fit items-center gap-1 px-1 text-sm font-semibold text-teal underline-offset-2 hover:underline">
        <span aria-hidden="true">←</span> All cocktails
      </Link>

      <header className="tiki-header relative overflow-hidden rounded-3xl px-5 py-6 text-white shadow-lg">
        <span aria-hidden="true" className="pointer-events-none absolute -right-4 -top-6 text-8xl opacity-20">
          🏴‍☠️
        </span>
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Smuggler&apos;s Cove</p>
        <h1 className="relative mt-1 text-3xl font-extrabold tracking-tight">Rum numbers</h1>
        <p className="relative mt-2 max-w-sm text-sm text-white/90">
          The book sorts rum into 21 categories by what it&apos;s made from, the still and its age, and numbers the eight its
          recipes use. Put the number on tape on each bottle&apos;s neck, as the book suggests.
        </p>
      </header>

      {labeled && (
        <FocusMessage
          role={labeled.role}
          className={`rounded-2xl border bg-card p-3 text-sm shadow-sm ${labeled.role === "alert" ? "border-coral/30 text-coral-deep" : "border-teal/30 text-teal-deep"}`}
        >
          {labeled.text}
        </FocusMessage>
      )}

      <nav aria-label="The numbers" className="flex flex-wrap gap-1.5">
        {SC_CATEGORIES.filter((c) => c.number).map((c) => (
          <RumBadge key={c.id} category={c} />
        ))}
      </nav>

      <section aria-labelledby="checker-heading" className="rounded-2xl bg-card p-4 shadow-sm">
        <h2 id="checker-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          What number is this bottle?
        </h2>
        <div className="mt-3">
          {user?.taster ? (
            <RumChecker barRums={(barRums ?? []).map((r) => ({ ingredientId: r.ingredientId, styleName: r.styleName, bottle: r.bottle }))} />
          ) : (
            <p className="text-sm text-ink-soft">
              <Link href="/login?next=%2Frums" className="font-semibold text-teal underline underline-offset-2">
                Sign in
              </Link>{" "}
              to check a bottle from a photo. You can still look a bottle up in the book&apos;s list below.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="lookup-heading" className="rounded-2xl bg-card p-4 shadow-sm">
        <h2 id="lookup-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          Look it up in the book&apos;s list
        </h2>
        <form action="/rums" method="get" role="search" className="mt-2 flex gap-2">
          <label htmlFor="rum-q" className="sr-only">
            Bottle, brand or category
          </label>
          <input
            id="rum-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="e.g. El Dorado, agricole, Coruba"
            className="w-full min-w-0 rounded-xl border border-teal bg-card px-3 py-2.5 text-base text-ink shadow-sm"
          />
          <button type="submit" className="shrink-0 rounded-full bg-teal-deep px-4 text-sm font-bold text-white">
            Look up
          </button>
        </form>
        {q && (
          <div className="mt-3">
            <p role="status" className="sr-only">
              {hits.length === 0 ? `“${q}” isn't in the book's list.` : `${Math.min(hits.length, 20)} matching ${hits.length === 1 ? "bottle" : "bottles"}`}
            </p>
            {hits.length === 0 ? (
              <p className="text-sm text-ink-soft">
                &ldquo;{q}&rdquo; isn&apos;t in the book&apos;s list.{user?.taster ? " Try the checker above for a best guess." : ""}
              </p>
            ) : (
              <ul aria-label="Matching bottles" className="flex flex-col divide-y divide-teal/10">
                {hits.slice(0, 20).map((h) => (
                  <li key={`${h.category.id}-${h.bottle.label}`} className="flex flex-wrap items-center gap-2 py-2 text-sm text-ink">
                    <span className="min-w-0 flex-1">
                      {h.bottle.label} <span className="text-xs text-ink-faint">({h.bottle.region})</span>
                    </span>
                    <RumBadge category={h.category} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {barRums && (
        <section id="our-rums" aria-labelledby="ours-heading" className="scroll-mt-4 rounded-2xl bg-card p-4 shadow-sm">
          <h2 id="ours-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Our rums
          </h2>
          {barRums.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              No rums in{" "}
              <Link href="/cabinet" className="font-semibold text-teal underline underline-offset-2">
                our bar
              </Link>{" "}
              yet.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col divide-y divide-teal/10">
              {barRums.map((r) => {
                const c = barRumCategory(r.ingredientId, r.bottle, r.rumCategory, r.rumCategoryBasis);
                return (
                  <li key={r.ingredientId} className="flex flex-col gap-1.5 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold text-ink">{r.bottle ?? r.styleName}</span>
                        {r.bottle && <span className="block text-xs text-ink-faint">{r.styleName}</span>}
                      </span>
                      {c ? <RumBadge category={c.category} approx={c.approx} /> : <span className="text-xs text-ink-faint">Not classified</span>}
                    </div>
                    {c && (
                      <p className="text-xs text-ink-soft">
                        Number from: {BASIS_TEXT[c.basis === "saved" && r.rumCategoryBasis === "ai" ? "saved-ai" : c.basis]}.
                      </p>
                    )}
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-teal underline-offset-2 hover:underline">
                        Change its label<span className="sr-only"> for {r.bottle ?? r.styleName}</span>
                      </summary>
                      <form action={labelBarRum} className="mt-2 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="ingredient" value={r.ingredientId} />
                        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold text-ink">
                          Category
                          <select
                            name="category"
                            defaultValue={r.rumCategory ?? ""}
                            className="w-full rounded-xl border border-teal bg-card px-2 py-2 text-sm font-normal text-ink"
                          >
                            <option value="">From the book / its style</option>
                            {SC_CATEGORIES.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.number ? `${cat.number}. ` : ""}
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <SubmitButton pendingText="Saving…" className="rounded-full bg-teal-deep px-3 py-2 text-xs font-bold text-white">
                          Save
                        </SubmitButton>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {SC_GROUPS.map((g) => (
        <section key={g.id} aria-labelledby={`group-${g.id}`} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 id={`group-${g.id}`} className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              {g.label}
            </h2>
            <span aria-hidden="true" className="h-px flex-1 bg-teal/20" />
          </div>
          {SC_CATEGORIES.filter((c) => c.group === g.id).map((c) => {
            const styles = stylesByCategory.get(c.id) ?? [];
            return (
              <article key={c.id} id={c.id} aria-labelledby={`${c.id}-name`} className="scroll-mt-4 rounded-2xl bg-card p-4 shadow-sm">
                <h3 id={`${c.id}-name`} className="flex items-center gap-2 text-base font-bold text-ink">
                  {c.number ? (
                    <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm text-white">
                      {c.number}
                    </span>
                  ) : null}
                  <span>
                    {c.number ? <span className="sr-only">Number {c.number}: </span> : null}
                    {c.name}
                  </span>
                </h3>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {c.number ? "Numbered: the book's recipes call for it" : "No number"} · p. {c.page}
                </p>
                <ul className="mt-2 flex flex-col gap-0.5 text-sm text-ink">
                  {c.bottles.map((bt) => (
                    <li key={bt.label}>
                      {bt.label} <span className="text-xs text-ink-faint">({bt.region})</span>
                    </li>
                  ))}
                </ul>
                {styles.length > 0 && (
                  <p className="mt-2 text-xs text-ink-soft">
                    Our closest {styles.length === 1 ? "style" : "styles"}:{" "}
                    {styles.map((s, i) => (
                      <span key={s}>
                        {i > 0 && ", "}
                        <Link href={`/ingredients/${s}`} prefetch={false} className="font-semibold text-teal underline underline-offset-2">
                          {getIngredient(s)?.name ?? s}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      ))}

      <p className="text-center text-xs text-ink-faint">
        Categories and bottles from{" "}
        <a href={SC_SOURCE.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-teal underline underline-offset-2">
          <cite>{SC_SOURCE.title}</cite>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>{" "}
        by {SC_SOURCE.authors} ({SC_SOURCE.year}), pp. {SC_SOURCE.pages}. Bottles are as listed in {SC_SOURCE.year}; some have been
        renamed since.
      </p>
    </main>
  );
}
