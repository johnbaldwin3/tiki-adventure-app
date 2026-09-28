import Link from "next/link";
import { setDrinkCollections } from "@/app/collections/actions";
import type { Collection } from "@/lib/collections";
import type { CocktailCollection } from "@/lib/collections-data";
import { FocusMessage } from "./focus-message";
import { SubmitButton } from "./submit-button";

/**
 * The collections a drink is in (with any notes, e.g. its Prohibition-era
 * story and source), plus checkboxes for tasters to change them.
 */
export function CollectionsPanel({
  slug,
  name,
  all,
  mine,
  canEdit,
  status,
}: {
  slug: string;
  name: string;
  all: Collection[];
  mine: CocktailCollection[];
  canEdit: boolean;
  status?: string | string[];
}) {
  const inIds = new Set(mine.map((c) => c.id));
  const notes = mine.filter((c) => c.note);
  if (mine.length === 0 && !canEdit) return null;
  return (
    <section id="collections" aria-labelledby="collections-heading" className="rounded-2xl bg-card p-4 shadow-sm">
      <h2 id="collections-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
        Collections
      </h2>
      {status === "saved" && (
        <FocusMessage role="status" className="mt-2 text-sm font-semibold text-teal-deep">
          Collections saved.
        </FocusMessage>
      )}
      {status === "error" && (
        <FocusMessage role="alert" className="mt-2 text-sm font-semibold text-coral-deep">
          Couldn&apos;t save the collections. Please try again.
        </FocusMessage>
      )}
      {mine.length > 0 ? (
        <ul aria-label={`Collections with ${name}`} className="mt-2 flex flex-wrap gap-1.5">
          {mine.map((c) => (
            <li key={c.id}>
              <Link
                href={`/?c=${encodeURIComponent(c.slug)}`}
                className="inline-block rounded-full border border-teal/30 px-2.5 py-1 text-xs font-semibold text-teal-deep hover:bg-sand-deep"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm italic text-ink-faint">Not in any collection yet.</p>
      )}
      {notes.map((c) => (
        <p key={c.id} className="mt-3 text-sm text-ink-soft">
          <span className="font-semibold text-ink">{c.name}:</span> {c.note}
          {c.noteUrl && (
            <>
              {" "}
              <a
                href={c.noteUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-semibold text-teal underline underline-offset-2"
              >
                Source<span className="sr-only"> for the {c.name} note (opens in a new tab)</span>
              </a>
            </>
          )}
        </p>
      ))}
      {canEdit && all.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-teal underline-offset-2 hover:underline">
            Change collections
          </summary>
          <form action={setDrinkCollections} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="slug" value={slug} />
            <fieldset>
              <legend className="sr-only">Collections for {name}</legend>
              <div className="flex flex-col gap-1.5">
                {all.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-ink">
                    <input type="hidden" name="shown" value={c.id} />
                    <input
                      type="checkbox"
                      name="collection"
                      value={c.id}
                      defaultChecked={inIds.has(c.id)}
                      className="size-5 accent-teal-deep"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
            {mine.some((c) => c.note) && (
              <p className="text-xs text-ink-faint">Taking a drink out of a collection also removes its note there.</p>
            )}
            <SubmitButton className="w-fit rounded-full bg-teal-deep px-4 py-2 text-sm font-bold text-white shadow-sm" pendingText="Saving…">
              Save collections
            </SubmitButton>
            <Link href="/collections" className="w-fit text-xs font-semibold text-teal underline underline-offset-2">
              Add or rename collections
            </Link>
          </form>
        </details>
      )}
    </section>
  );
}
