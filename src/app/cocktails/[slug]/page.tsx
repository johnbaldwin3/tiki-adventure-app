import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { cookies } from "next/headers";
import { cache } from "react";
import { AmountControls } from "@/components/amount-controls";
import { displayAmount, parseServings, parseUnitMode, UNITS_COOKIE } from "@/lib/amounts";
import {
  fetchCocktailBySlug,
  fetchCocktailRecords,
  type CocktailDetail,
  type TasterEntry,
} from "@/lib/cocktails";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { drinkAvailability } from "@/lib/cabinet";
import { fetchBar, fetchCabinet, fetchPour, fetchShoppingList } from "@/lib/cabinet-data";
import { MadeThis } from "@/components/made-this";
import { pourLines } from "@/lib/inventory";
import { FocusMessage } from "@/components/focus-message";
import { ShoppingButton, ShoppingStatus } from "@/components/shopping-button";
import { getIngredient, resolveLine } from "@/lib/ingredients";
import { SLUG_PATTERN } from "@/lib/slug";
import { averageRating, rankCocktails } from "@/lib/tasting";

// Always-fresh reads, same reasoning as the home page (src/app/page.tsx):
// tasters edit ratings/notes, and a cached card would show stale data.
export const dynamic = "force-dynamic";

// generateMetadata and the page both need the cocktail; cache() dedupes
// the Supabase round-trip within a single request.
const getCocktail = cache((slug: string) => fetchCocktailBySlug(slug));

export async function generateMetadata({
  params,
}: PageProps<"/cocktails/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!SLUG_PATTERN.test(slug)) return { title: "Cocktail not found" };
  try {
    const cocktail = await getCocktail(slug);
    if (cocktail) return { title: cocktail.name };
    return { title: "Cocktail not found" };
  } catch (err) {
    console.error("cocktail metadata: failed to load", slug, err);
    // Fall through to the default title; the page itself shows the error.
  }
  return {};
}

function formatDate(iso: string): string {
  // tasted_at is a plain date ("2026-06-01"); parse as UTC so it doesn't
  // shift a day in US timezones.
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Recipe wording, linked to its ingredient page (style, brands to buy, other drinks). */
function IngredientText({ text, catalogId }: { text: string; catalogId: string | null }) {
  const resolved = resolveLine(text, catalogId);
  if (!resolved) return <span className="text-ink">{text}</span>;
  return (
    <Link
      href={`/ingredients/${resolved.ingredient.id}`}
      prefetch={false}
      className="text-ink underline decoration-teal/40 decoration-1 underline-offset-4 hover:decoration-teal"
    >
      {text}
    </Link>
  );
}

/** Where one of our recipes came from, plus edit/delete for tasters. */
function OurRecipeFooter({ cocktail, canEdit }: { cocktail: CocktailDetail; canEdit: boolean }) {
  let host: string | null = null;
  try {
    host = cocktail.sourceUrl ? new URL(cocktail.sourceUrl).hostname.replace(/^www\./, "") : null;
  } catch {
    host = null;
  }
  return (
    <div className="flex flex-col items-center gap-2 pt-2 text-center text-xs text-ink-faint">
      <p>
        Added by us{cocktail.sourceNote ? ` — from ${cocktail.sourceNote}` : ""}
        {host && cocktail.sourceUrl && (
          <>
            {cocktail.sourceNote ? " (" : " — from "}
            <a
              href={cocktail.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-semibold text-teal underline underline-offset-2"
            >
              {host}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            {cocktail.sourceNote ? ")" : ""}
          </>
        )}
        .
      </p>
      {canEdit && (
        <Link
          href={`/cocktails/${cocktail.slug}/edit`}
          className="rounded-full border border-teal/30 bg-card px-3 py-1.5 font-semibold text-teal-deep"
        >
          Edit or delete this recipe
        </Link>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      className="inline-flex w-fit items-center gap-1 rounded-full px-1 text-sm font-semibold text-teal underline-offset-2 hover:underline"
    >
      <span aria-hidden="true">←</span> All cocktails
    </Link>
  );
}

function TasterCard({ taster, slug, canEdit }: { taster: TasterEntry; slug: string; canEdit: boolean }) {
  const status = taster.rating !== null
    ? null
    : taster.tried
      ? "Tried — not rated yet"
      : "Not tasted yet";
  return (
    <li className="rounded-xl border border-teal/15 bg-card p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-deep text-xs font-bold text-white"
        >
          {taster.initials}
        </span>
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-semibold text-ink">{taster.displayName}</span>
          {taster.tastedAt && (
            <span className="text-xs text-ink-faint">Tasted {formatDate(taster.tastedAt)}</span>
          )}
        </div>
        {taster.rating !== null ? (
          <span className="rounded-full bg-coral-deep px-3 py-1 text-sm font-bold text-white">
            <span className="sr-only">Rating </span>
            {taster.rating}
            <span className="font-normal text-white/80"> / 10</span>
          </span>
        ) : (
          <span className="text-xs font-semibold text-ink-soft">{status}</span>
        )}
      </div>
      <p
        className={`mt-2 whitespace-pre-line text-sm ${taster.notes ? "text-ink" : "italic text-ink-faint"}`}
      >
        {taster.notes ?? "No notes yet."}
      </p>
      {canEdit && (
        <Link
          href={`/cocktails/${slug}/tasting/${taster.initials.toLowerCase()}`}
          className="mt-3 inline-flex items-center gap-1 rounded-full border border-teal/30 px-3 py-1.5 text-sm font-semibold text-teal-deep hover:bg-sand-deep"
        >
          {taster.rating !== null || taster.notes ? "Edit" : "Add rating & notes"}
          <span className="sr-only"> for {taster.displayName}</span>
        </Link>
      )}
    </li>
  );
}

export default async function CocktailPage({ params, searchParams }: PageProps<"/cocktails/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { shopping, recipe } = sp;
  const servings = parseServings(sp.serves);
  // The unit in the URL wins; otherwise the one last picked (cookie); else as written.
  const urlUnits = parseUnitMode(sp.units);
  const units = urlUnits ?? parseUnitMode((await cookies()).get(UNITS_COOKIE)?.value) ?? "original";
  // Junk/bot URLs 404 without touching the database.
  if (!SLUG_PATTERN.test(slug)) notFound();

  // "Our #N" needs every cocktail's ratings; it's a nice-to-have, so a
  // failure there shouldn't take down an otherwise-loaded recipe card.
  const recordsPromise = fetchCocktailRecords().catch((err) => {
    console.error("recipe card: failed to load rankings", err);
    return null;
  });
  const userPromise = getSignedInUser().catch((err) => {
    unstable_rethrow(err);
    console.error("recipe card: failed to load signed-in user", err);
    return null;
  });

  let cocktail: Awaited<ReturnType<typeof fetchCocktailBySlug>>;
  try {
    cocktail = await getCocktail(slug);
  } catch (err) {
    console.error("recipe card: failed to load", slug, err);
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-8 pt-6 sm:max-w-lg">
        <BackLink />
        <p
          role="alert"
          className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm"
        >
          Couldn&apos;t load this recipe right now. Please try refreshing the page.
        </p>
      </main>
    );
  }

  if (!cocktail) notFound();

  const barPromise = fetchBar().catch((err) => {
    unstable_rethrow(err);
    console.error("recipe card: failed to load bar levels", err);
    return null;
  });
  const pourPromise = typeof sp.made === "string" && /^[0-9a-f-]{36}$/i.test(sp.made) ? fetchPour(sp.made, cocktail.id) : Promise.resolve(null);
  const cabinetPromise = fetchCabinet().catch((err) => {
    unstable_rethrow(err);
    console.error("recipe card: failed to load cabinet", err);
    return null;
  });
  const listPromise = fetchShoppingList().catch((err) => {
    unstable_rethrow(err);
    console.error("recipe card: failed to load shopping list", err);
    return null;
  });
  const [records, user, cabinet, list, bar, pour] = await Promise.all([
    recordsPromise,
    userPromise,
    cabinetPromise,
    listPromise,
    barPromise,
    pourPromise,
  ]);
  // Only for signed-in tasters (RLS); null otherwise.
  const availability = cabinet
    ? drinkAvailability(
        {
          ...cocktail,
          tried: false,
          ingredientTexts: cocktail.ingredients.map((i) => i.ingredient),
          ingredientIds: cocktail.ingredients.map((i) => i.catalogId),
        },
        new Set(cabinet.keys())
      )
    : null;
  const missing = availability?.missing ?? null;
  const notListed = missing && list ? missing.filter((id) => !list.has(id)) : null;
  const missingNames = (missing ?? []).map((id) => getIngredient(id)?.name ?? id).join(", ");
  const myInitials = user?.taster?.initials ?? null;
  const ourRank = records
    ? (rankCocktails(records).find((r) => r.name === cocktail.name)?.rank ?? null)
    : null;

  const jb = cocktail.tasters.find((t) => t.initials === "JB");
  const gm = cocktail.tasters.find((t) => t.initials === "GM");
  const avg = averageRating(jb?.rating, gm?.rating);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-8 pt-6 sm:max-w-lg">
      <BackLink />

      {(recipe === "added" || recipe === "saved") && (
        <FocusMessage role="status" className="rounded-2xl border border-teal/30 bg-card p-3 text-sm text-teal-deep shadow-sm">
          {recipe === "added" ? "Recipe added to our list." : "Recipe saved."}
        </FocusMessage>
      )}

      <header className="tiki-header relative overflow-hidden rounded-3xl px-5 py-6 text-white shadow-lg">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-4 -top-6 text-8xl opacity-20"
        >
          🍹
        </span>
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
          {cocktail.source === "ours"
            ? `Our recipe${cocktail.addedBy ? ` · added by ${cocktail.addedBy}` : ""}`
            : `Difford's Top 100 · #${cocktail.diffordsRank}`}
        </p>
        <h1 className="relative mt-1 text-3xl font-extrabold tracking-tight">{cocktail.name}</h1>
        {cocktail.primarySpirits.length > 0 && (
          <p className="relative mt-2 text-sm text-white/90">
            {cocktail.primarySpirits.join(" · ")}
          </p>
        )}
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          {avg !== null && (
            <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-teal-deep">
              <span aria-hidden="true">★ </span>
              <span className="sr-only">Average rating </span>
              {avg} avg{ourRank ? ` · our #${ourRank}` : ""}
            </span>
          )}
          <a
            href="#tasting"
            className="rounded-full border border-white/60 px-3 py-1 text-sm font-semibold text-white hover:bg-white/10"
          >
            Our tasting notes ↓
          </a>
        </div>
      </header>

      <section aria-labelledby="ingredients-heading" className="rounded-2xl bg-card p-4 shadow-sm">
        <h2
          id="ingredients-heading"
          className="text-sm font-bold uppercase tracking-wide text-ink-soft"
        >
          Ingredients
          {servings > 1 && <span className="font-normal normal-case tracking-normal"> · for {servings} drinks</span>}
        </h2>
        {cocktail.ingredients.length > 0 && <AmountControls slug={cocktail.slug} servings={servings} units={units} urlUnits={urlUnits} />}
        {cocktail.ingredients.length > 0 ? (
          <ul className="mt-3 flex flex-col divide-y divide-teal/10">
            {cocktail.ingredients.map((ing, i) => {
              const shown = displayAmount(ing.amount, ing.unit, servings, units);
              return (
                <li key={`${i}-${ing.ingredient}`} className="flex gap-3 py-2 text-sm">
                  <span className="flex min-w-20 shrink-0 flex-col font-bold text-teal-deep">
                    <span className="whitespace-nowrap">{[shown.amount, shown.unit].filter(Boolean).join(" ")}</span>
                    {shown.note && <span className="text-xs font-normal text-ink-soft">{shown.note}</span>}
                  </span>
                  <IngredientText text={ing.ingredient} catalogId={ing.catalogId} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm italic text-ink-faint">No ingredients listed.</p>
        )}
        {cocktail.ingredients.some((ing) => displayAmount(ing.amount, ing.unit, servings, units).converted) && (
          <p className="mt-2 text-xs text-ink-faint">Converted at the bar standard 1 fl oz = 30 ml (1 cup = 8 fl oz).</p>
        )}
        {missing && (
          <>
          <p className="mt-3 rounded-xl bg-sand-deep px-3 py-2 text-sm text-teal-deep">
            {missing.length === 0 && availability!.unknown.length > 0 ? (
              <>
                Can&apos;t tell if we can make this:{" "}
                <Link href="/cabinet" className="font-semibold underline underline-offset-2">
                  our bar
                </Link>{" "}
                doesn&apos;t track {availability!.unknown.join(", ")}.
              </>
            ) : missing.length === 0 ? (
              <>
                <span aria-hidden="true">✓ </span>We can make this with what&apos;s in{" "}
                <Link href="/cabinet" className="font-semibold underline underline-offset-2">
                  our bar
                </Link>
                .
              </>
            ) : (
              <>
                Missing from{" "}
                <Link href="/cabinet" className="font-semibold underline underline-offset-2">
                  our bar
                </Link>
                :{" "}
                {missing.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ", "}
                    <Link href={`/ingredients/${id}`} prefetch={false} className="font-semibold underline underline-offset-2">
                      {getIngredient(id)?.name ?? id}
                    </Link>
                  </span>
                ))}
              </>
            )}
          </p>
          {missing.length > 0 && notListed && (
            <div className="mt-2">
              {notListed.length === 0 ? (
                <ShoppingButton
                  ids={missing}
                  onList
                  returnTo={`/cocktails/${slug}`}
                  itemName={missingNames}
                />
              ) : (
                <ShoppingButton
                  ids={notListed}
                  onList={false}
                  returnTo={`/cocktails/${slug}`}
                  label={
                    notListed.length === 1
                      ? missing.length === 1
                        ? "Add to shopping list"
                        : `Add ${getIngredient(notListed[0])?.name ?? notListed[0]} to shopping list`
                      : notListed.length === missing.length
                        ? `Add all ${missing.length} to shopping list`
                        : `Add the ${notListed.length} not on the shopping list`
                  }
                />
              )}
            </div>
          )}
          </>
        )}
        {typeof shopping === "string" && (
          <div className="mt-2">
            <ShoppingStatus status={shopping} />
          </div>
        )}
      </section>

      {bar && user?.taster && (
        <MadeThis
          slug={cocktail.slug}
          servings={servings}
          lines={pourLines(cocktail.ingredients, servings)}
          inventory={bar.inventory}
          made={typeof sp.made === "string" ? sp.made : undefined}
          pour={pour}
        />
      )}

      <section aria-label="Glass and garnish" className="grid grid-cols-2 gap-3">
        {[
          { icon: "🥃", label: "Glass", value: cocktail.glass },
          { icon: "🍍", label: "Garnish", value: cocktail.garnish },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-teal/15 bg-sand-deep p-3 shadow-sm"
          >
            <p aria-hidden="true" className="text-lg leading-none">{item.icon}</p>
            <h2 className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-teal">
              {item.label}
            </h2>
            <p className="text-sm font-semibold text-teal-deep">{item.value ?? "—"}</p>
          </div>
        ))}
      </section>

      {cocktail.methodSummary && (
        <section aria-labelledby="method-heading" className="rounded-2xl bg-card p-4 shadow-sm">
          <h2 id="method-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Method
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink">{cocktail.methodSummary}</p>
        </section>
      )}

      <section
        id="tasting"
        aria-labelledby="tasting-heading"
        className="flex scroll-mt-4 flex-col gap-3"
      >
        <div className="flex items-center gap-2">
          <h2 id="tasting-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Our tasting
          </h2>
          <span aria-hidden="true" className="h-px flex-1 bg-teal/20" />
        </div>
        <ul className="flex flex-col gap-2">
          {cocktail.tasters.map((t) => (
            <TasterCard key={t.initials} taster={t} slug={cocktail.slug} canEdit={t.initials === myInitials} />
          ))}
        </ul>
        {user && !user.taster && (
          <p className="text-center text-sm text-ink-soft">
            You&apos;re signed in as {user.email}, which isn&apos;t linked to a taster.
          </p>
        )}
        {!user && (
          <p className="text-center text-sm text-ink-soft">
            <Link
              href={`/login?next=${encodeURIComponent(`/cocktails/${cocktail.slug}`)}`}
              className="font-semibold text-teal underline-offset-2 hover:underline"
            >
              Sign in
            </Link>{" "}
            to add your rating &amp; notes.
          </p>
        )}
      </section>

      {cocktail.source === "ours" ? (
        <OurRecipeFooter cocktail={cocktail} canEdit={!!user?.taster} />
      ) : (
        <p className="pt-2 text-center text-xs text-ink-faint">
          Recipe adapted from Difford&apos;s Guide —{" "}
          <a
            href={cocktail.diffordsGuideUrl ?? "https://www.diffordsguide.com/"}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-teal underline underline-offset-2"
          >
            see the original recipe<span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </p>
      )}
    </main>
  );
}
