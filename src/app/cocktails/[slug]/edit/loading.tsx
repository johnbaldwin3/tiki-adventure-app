// The edit form's own loading state (otherwise the recipe card's skeleton
// from ../loading.tsx would show).
export default function EditRecipeLoading() {
  return (
    <main aria-busy="true" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-8 pt-6 sm:max-w-lg">
      <p className="sr-only" role="status">
        Loading the recipe to edit…
      </p>
      <div aria-hidden="true" className="h-5 w-28 animate-pulse rounded-full bg-sand-deep" />
      <div aria-hidden="true" className="tiki-header h-28 animate-pulse rounded-3xl opacity-80" />
      <div aria-hidden="true" className="h-96 animate-pulse rounded-2xl bg-card shadow-sm" />
    </main>
  );
}
