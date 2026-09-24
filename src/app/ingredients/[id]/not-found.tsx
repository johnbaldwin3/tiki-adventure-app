import Link from "next/link";

export default function IngredientNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 pb-8 pt-16 text-center sm:max-w-lg">
      <p aria-hidden="true" className="text-5xl">🍋</p>
      <h1 className="text-2xl font-extrabold text-teal-deep">Ingredient not found</h1>
      <p className="text-sm text-ink-soft">That ingredient isn&apos;t in any of the Top 100 recipes.</p>
      <Link href="/ingredients" className="rounded-full bg-teal-deep px-4 py-2 text-sm font-semibold text-white shadow-sm">
        All ingredients
      </Link>
    </main>
  );
}
