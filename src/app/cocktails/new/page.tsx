import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { ingredientsByFamily } from "@/lib/ingredients";
import { ImportRecipe } from "./import-recipe";

export const dynamic = "force-dynamic";
// The recipe helper's model call can take a while (a photo especially).
export const maxDuration = 60;
export const metadata: Metadata = { title: "Add a recipe", robots: { index: false } };

export default async function NewRecipePage() {
  const user = await getSignedInUser();
  const shell = {
    eyebrow: "Our recipes",
    title: "Add a recipe",
    icon: "📖",
    intro: "From a photo of a book or card, a web page, or pasted text. You check it before it's saved.",
  };
  if (!user?.taster) {
    return (
      <PageShell {...shell}>
        <p className="rounded-2xl bg-card p-4 text-sm text-ink-soft shadow-sm">
          {user ? (
            <>Only JB &amp; GM can add recipes.</>
          ) : (
            <>
              <Link href="/login?next=%2Fcocktails%2Fnew" className="font-semibold text-teal underline underline-offset-2">
                Sign in
              </Link>{" "}
              to add a recipe.
            </>
          )}
        </p>
      </PageShell>
    );
  }
  const catalog = ingredientsByFamily().map((g) => ({
    family: g.family,
    items: g.items.map((i) => ({ id: i.id, name: i.name })),
  }));
  return (
    <PageShell {...shell}>
      <ImportRecipe catalog={catalog} />
    </PageShell>
  );
}
