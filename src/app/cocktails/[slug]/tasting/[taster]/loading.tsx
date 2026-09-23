// Overrides the recipe-card skeleton (../../loading.tsx) for the edit form.
export default function EditTastingLoading() {
  return (
    <main aria-busy="true" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-8 pt-6 sm:max-w-lg">
      <p className="sr-only" role="status">
        Loading your tasting…
      </p>
      <div aria-hidden="true" className="h-5 w-36 animate-pulse rounded-full bg-sand-deep" />
      <div aria-hidden="true" className="h-10 w-2/3 animate-pulse rounded-xl bg-sand-deep" />
      <div aria-hidden="true" className="h-14 animate-pulse rounded-xl bg-card shadow-sm" />
      <div aria-hidden="true" className="h-12 animate-pulse rounded-xl bg-card shadow-sm" />
      <div aria-hidden="true" className="h-12 animate-pulse rounded-xl bg-card shadow-sm" />
      <div aria-hidden="true" className="h-32 animate-pulse rounded-xl bg-card shadow-sm" />
    </main>
  );
}
