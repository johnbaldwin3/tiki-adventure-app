import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { fetchCocktailBySlug } from "@/lib/cocktails";
import { ingredientsByFamily } from "@/lib/ingredients";
import type { RecipeDraft } from "@/lib/recipe-form";
import { SLUG_PATTERN } from "@/lib/slug";
import { deleteRecipe } from "../../recipe-actions";
import { RecipeForm } from "../../recipe-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit recipe",
  robots: { index: false },
};

export default async function EditRecipePage({
  params,
  searchParams,
}: PageProps<"/cocktails/[slug]/edit">) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!SLUG_PATTERN.test(slug)) notFound();
  const user = await getSignedInUser();
  if (!user)
    redirect(`/login?next=${encodeURIComponent(`/cocktails/${slug}/edit`)}`);

  let cocktail: Awaited<ReturnType<typeof fetchCocktailBySlug>>;
  try {
    cocktail = await fetchCocktailBySlug(slug);
  } catch (err) {
    console.error("edit recipe: failed to load", slug, err);
    return (
      <PageShell
        back={{ href: `/cocktails/${slug}`, label: "Back to the recipe" }}
        eyebrow="Our recipes"
        title="Edit recipe"
      >
        <p
          role="alert"
          className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm"
        >
          Couldn&apos;t load this recipe right now. Please try refreshing the
          page.
        </p>
      </PageShell>
    );
  }
  // Difford's Top 100 recipes are verified and read-only.
  if (!cocktail || cocktail.source !== "ours") notFound();
  if (!user.taster) redirect(`/cocktails/${slug}`);

  const draft: RecipeDraft = {
    name: cocktail.name,
    primarySpirits: cocktail.primarySpirits.join(", "),
    glass: cocktail.glass ?? "",
    garnish: cocktail.garnish ?? "",
    method: cocktail.methodSummary ?? "",
    ingredients: cocktail.ingredients.map((i) => ({
      amount: i.amount,
      unit: i.unit,
      ingredient: i.ingredient,
      catalogId: i.catalogId ?? "",
    })),
    sourceUrl: cocktail.sourceUrl ?? "",
    sourceNote: cocktail.sourceNote ?? "",
  };
  const catalog = ingredientsByFamily().map((g) => ({
    family: g.family,
    items: g.items.map((i) => ({ id: i.id, name: i.name })),
  }));

  return (
    <PageShell
      back={{ href: `/cocktails/${slug}`, label: "Back to the recipe" }}
      eyebrow="Our recipes"
      title={`Edit ${cocktail.name}`}
      icon="📖"
    >
      <RecipeForm
        initial={draft}
        catalog={catalog}
        editSlug={slug}
        cancelHref={`/cocktails/${slug}`}
      />

      {cocktail.addedBy !== user.taster.initials ? (
        <p className="rounded-2xl bg-card p-4 text-sm text-ink-soft shadow-sm">
          Only {cocktail.addedBy ?? "the taster who added it"} can delete this
          recipe.
        </p>
      ) : (
        <details
          className="rounded-2xl border border-coral/30 bg-card p-4 text-sm shadow-sm"
          open={!!sp.delete}
        >
          <summary className="cursor-pointer font-semibold text-coral-deep">
            Delete this recipe
          </summary>
          {sp.delete && (
            <p role="alert" className="mt-2 font-semibold text-coral-deep">
              {sp.delete === "confirm"
                ? "Tick the box to confirm, then try again."
                : "Couldn't delete it right now. Please try again."}
            </p>
          )}
          <form action={deleteRecipe} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="slug" value={slug} />
            <label className="flex items-start gap-2 text-ink">
              <input
                type="checkbox"
                name="confirm"
                value="yes"
                required
                className="mt-0.5 h-5 w-5 accent-coral-deep"
              />
              <span>
                Yes, delete {cocktail.name} and our ratings and notes for it.
                This can&apos;t be undone.
              </span>
            </label>
            <button
              type="submit"
              className="w-fit rounded-full bg-coral-deep px-4 py-2.5 text-sm font-bold text-white"
            >
              Delete recipe
            </button>
          </form>
        </details>
      )}
      <p className="text-center text-xs text-ink-faint">
        <Link
          href={`/cocktails/${slug}`}
          className="font-semibold text-teal underline underline-offset-2"
        >
          Back to the recipe
        </Link>
      </p>
    </PageShell>
  );
}
