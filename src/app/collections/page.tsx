import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { fieldClass } from "@/components/form-field";
import { FocusMessage } from "@/components/focus-message";
import { PageShell, SectionHeading } from "@/components/page-shell";
import { SubmitButton } from "@/components/submit-button";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { COLLECTION_LIMITS, NAME_PROBLEMS, parseNameProblem, type Collection, type Membership } from "@/lib/collections";
import { fetchCollections } from "@/lib/collections-data";
import { createCollection, deleteCollection, updateCollection } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collections" };

const card = "rounded-2xl bg-card p-4 shadow-sm";

const MESSAGES: Record<string, { role: "status" | "alert"; text: string }> = {
  added: { role: "status", text: "Collection added." },
  saved: { role: "status", text: "Collection saved." },
  deleted: { role: "status", text: "Collection removed (its drinks are still on our list)." },
  confirm: { role: "alert", text: "Tick the box to confirm removing a collection." },
  error: { role: "alert", text: "Couldn't save that. Please try again." },
};

export default async function CollectionsPage({ searchParams }: PageProps<"/collections">) {
  const sp = await searchParams;
  const status = typeof sp.collections === "string" ? sp.collections : null;
  const problem = status === "invalid" ? parseNameProblem(sp.reason) : null;
  const problemFor = typeof sp.for === "string" ? sp.for : null;
  // Only the new-collection form gets its typed name back (to fix it).
  const retryName = problem && problemFor === "new" && typeof sp.name === "string" ? sp.name.slice(0, COLLECTION_LIMITS.name) : "";
  const shell = { eyebrow: "JB & GM's home bar", title: "Collections", icon: "🗂️" };

  let data: { collections: Collection[]; memberships: Membership[] } | null = null;
  try {
    data = await fetchCollections();
  } catch (err) {
    unstable_rethrow(err);
    console.error("collections: failed to load", err);
  }
  const user = await getSignedInUser().catch((err) => {
    unstable_rethrow(err);
    return null;
  });
  const canEdit = !!user?.taster;

  if (!data) {
    return (
      <PageShell {...shell}>
        <p role="alert" className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm">
          Couldn&apos;t load the collections right now. Please try refreshing the page.
        </p>
      </PageShell>
    );
  }
  const counts = new Map<string, number>();
  for (const m of data.memberships) counts.set(m.collectionId, (counts.get(m.collectionId) ?? 0) + 1);
  // Messages are only for tasters (the page is public; nothing typed is echoed to anyone else).
  const message = !canEdit
    ? undefined
    : problem
      ? { role: "alert" as const, text: NAME_PROBLEMS[problem] }
      : status && status !== "invalid"
        ? MESSAGES[status]
        : undefined;

  return (
    <PageShell {...shell} intro="Group drinks by style, era or mood. A drink can be in as many as you like.">
      {message && (
        <FocusMessage
          role={message.role}
          className={`rounded-2xl border bg-card p-3 text-sm shadow-sm ${message.role === "alert" ? "border-coral/30 text-coral-deep" : "border-teal/30 text-teal-deep"}`}
        >
          {message.text}
        </FocusMessage>
      )}

      <section aria-labelledby="list-heading" className="flex flex-col gap-2">
        <SectionHeading id="list-heading">Our collections</SectionHeading>
        <ul className="flex flex-col gap-3">
          {data.collections.map((c) => (
            <li key={c.id} className={card}>
              <div className="flex items-baseline justify-between gap-2">
                <Link
                  href={`/?c=${encodeURIComponent(c.slug)}`}
                  className="text-base font-bold text-teal-deep underline-offset-2 hover:underline"
                >
                  {c.name}
                </Link>
                <span className="shrink-0 text-xs text-ink-soft">
                  {counts.get(c.id) ?? 0} {(counts.get(c.id) ?? 0) === 1 ? "drink" : "drinks"}
                </span>
              </div>
              {c.description && <p className="mt-1 text-sm text-ink-soft">{c.description}</p>}
              {canEdit && (
                <details className="mt-2" open={problemFor === c.id || undefined}>
                  <summary className="cursor-pointer text-sm font-semibold text-teal underline-offset-2 hover:underline">
                    Rename or describe<span className="sr-only"> {c.name}</span>
                  </summary>
                  <form action={updateCollection} className="mt-2 flex flex-col gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <label className="text-sm font-semibold text-ink" htmlFor={`name-${c.id}`}>
                      Name
                    </label>
                    <input
                      id={`name-${c.id}`}
                      name="name"
                      required
                      maxLength={COLLECTION_LIMITS.name}
                      defaultValue={c.name}
                      className={`${fieldClass} border-teal`}
                    />
                    <label className="text-sm font-semibold text-ink" htmlFor={`desc-${c.id}`}>
                      Description <span className="font-normal text-ink-soft">(optional)</span>
                    </label>
                    <textarea
                      id={`desc-${c.id}`}
                      name="description"
                      rows={2}
                      maxLength={COLLECTION_LIMITS.description}
                      defaultValue={c.description ?? ""}
                      className={`${fieldClass} border-teal`}
                    />
                    <SubmitButton
                      className="w-fit rounded-full bg-teal-deep px-4 py-2 text-sm font-bold text-white shadow-sm"
                      pendingText="Saving…"
                    >
                      Save<span className="sr-only"> {c.name}</span>
                    </SubmitButton>
                  </form>
                  {c.builtIn ? (
                    <p className="mt-2 text-xs text-ink-faint">This is one of the starting collections, so it can&apos;t be removed.</p>
                  ) : (
                    <form action={deleteCollection} className="mt-3 flex flex-col gap-2 border-t border-teal/15 pt-3">
                      <input type="hidden" name="id" value={c.id} />
                      <label className="flex items-center gap-2 text-sm text-ink">
                        <input type="checkbox" name="confirm" required className="size-5 accent-coral-deep" />
                        Yes, remove {c.name} (the drinks stay on our list)
                      </label>
                      <SubmitButton
                        className="w-fit rounded-full border border-coral/40 px-4 py-2 text-sm font-bold text-coral-deep"
                        pendingText="Removing…"
                      >
                        Remove collection<span className="sr-only"> {c.name}</span>
                      </SubmitButton>
                    </form>
                  )}
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>

      {canEdit ? (
        <section aria-labelledby="new-heading" className={card}>
          <h2 id="new-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            New collection
          </h2>
          <form action={createCollection} className="mt-2 flex flex-col gap-2">
            <label className="text-sm font-semibold text-ink" htmlFor="new-name">
              Name
            </label>
            <input
              id="new-name"
              name="name"
              required
              maxLength={COLLECTION_LIMITS.name}
              defaultValue={retryName}
              placeholder="e.g. Stirred & boozy"
              className={`${fieldClass} border-teal`}
            />
            <label className="text-sm font-semibold text-ink" htmlFor="new-description">
              Description <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <textarea
              id="new-description"
              name="description"
              rows={2}
              maxLength={COLLECTION_LIMITS.description}
              className={`${fieldClass} border-teal`}
            />
            <SubmitButton
              className="w-fit rounded-full bg-teal-deep px-4 py-2 text-sm font-bold text-white shadow-sm"
              pendingText="Adding…"
            >
              Add collection
            </SubmitButton>
          </form>
          <p className="mt-3 text-xs text-ink-faint">
            Add drinks to it from any recipe card (&ldquo;Change collections&rdquo;), or when adding a recipe.
          </p>
        </section>
      ) : (
        <p className={`${card} text-sm text-ink-soft`}>
          <Link href="/login?next=%2Fcollections" className="font-semibold text-teal underline underline-offset-2">
            Sign in
          </Link>{" "}
          to add or rename collections.
        </p>
      )}
    </PageShell>
  );
}
