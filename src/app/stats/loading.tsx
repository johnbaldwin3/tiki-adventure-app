// Shown instantly on navigation to /stats while its Supabase query runs.
export default function StatsLoading() {
  return (
    <main aria-busy="true" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-8 pt-6 sm:max-w-lg">
      <p className="sr-only" role="status">
        Loading stats…
      </p>
      <div aria-hidden="true" className="h-5 w-28 animate-pulse rounded-full bg-sand-deep" />
      <div aria-hidden="true" className="tiki-header h-40 animate-pulse rounded-3xl opacity-80" />
      <div aria-hidden="true" className="h-56 animate-pulse rounded-2xl bg-card shadow-sm" />
      <div aria-hidden="true" className="grid grid-cols-2 gap-3">
        <div className="h-28 animate-pulse rounded-2xl bg-sand-deep" />
        <div className="h-28 animate-pulse rounded-2xl bg-sand-deep" />
      </div>
    </main>
  );
}
