// Shown instantly when a list row is tapped (rows don't prefetch -- see
// src/app/page.tsx), while the recipe card's Supabase queries run.
export default function CocktailLoading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-8 pt-6 sm:max-w-lg"
    >
      <p className="sr-only" role="status">
        Loading recipe…
      </p>
      <div aria-hidden="true" className="h-5 w-28 animate-pulse rounded-full bg-sand-deep" />
      <div aria-hidden="true" className="tiki-header h-44 animate-pulse rounded-3xl opacity-80" />
      <div aria-hidden="true" className="h-64 animate-pulse rounded-2xl bg-card shadow-sm" />
      <div aria-hidden="true" className="grid grid-cols-2 gap-3">
        <div className="h-24 animate-pulse rounded-2xl bg-sand-deep" />
        <div className="h-24 animate-pulse rounded-2xl bg-sand-deep" />
      </div>
    </main>
  );
}
