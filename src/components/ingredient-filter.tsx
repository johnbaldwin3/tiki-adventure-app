import Form from "next/form";
import Link from "next/link";
import { FilterFocus } from "./filter-focus";
import { getIngredient, ingredientsByFamily } from "@/lib/ingredients";
import { listHref, type IngredientMatch, type ListFilter } from "@/lib/list";

interface Props {
  show: ListFilter;
  selected: string[];
  match: IngredientMatch;
  /** Drinks (of all 100) using each ingredient id, shown in the picker. */
  usageCounts: Record<string, number>;
  resultCount: number;
}

/**
 * "Filter by ingredient" for the home list. Server-rendered: a Next <Form>
 * (a GET form that navigates client-side without jumping to the top, and
 * still works without JavaScript) with a native <select> grouped by family
 * (great on phones) and an Add button, plus link chips to remove each
 * choice. Every state is a shareable URL.
 */
export function IngredientFilter({ show, selected, match, usageCounts, resultCount }: Props) {
  const chosen = selected.map((id) => getIngredient(id)).filter((i) => !!i);
  const groups = ingredientsByFamily()
    .map((g) => ({ ...g, items: g.items.filter((i) => !selected.includes(i.id) && (usageCounts[i.id] ?? 0) > 0) }))
    .filter((g) => g.items.length > 0);

  return (
    <details
      id="ingredient-filter"
      open={selected.length > 0}
      className="rounded-2xl border border-teal/15 bg-card p-3 shadow-sm"
    >
      <FilterFocus stateKey={`${selected.join(",")}|${match}`} />
      <summary id="ingredient-filter-summary" className="cursor-pointer text-sm font-semibold text-teal-deep">
        Filter by ingredient
        {selected.length > 0 && <span className="font-normal text-ink-soft"> · {selected.length} chosen</span>}
      </summary>

      <div className="mt-3 flex flex-col gap-3">
        {chosen.length > 0 && (
          <ul aria-label="Chosen ingredients" className="flex flex-wrap gap-2">
            {chosen.map((i) => (
              <li key={i.id}>
                <Link
                  href={listHref({ show, ing: selected.filter((id) => id !== i.id), match })}
                  scroll={false}
                  aria-label={`Remove ${i.name}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-teal-deep px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {i.name}
                  <span aria-hidden="true">✕</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {selected.length > 1 && (
          <nav aria-label="Ingredient match" className="flex items-center gap-2 text-xs">
            <span className="text-ink-soft">Show drinks with</span>
            {(["all", "any"] as const).map((m) => (
              <Link
                key={m}
                href={listHref({ show, ing: selected, match: m })}
                scroll={false}
                aria-current={match === m ? "true" : undefined}
                className={`rounded-full px-2.5 py-1.5 font-semibold ${
                  match === m ? "bg-teal-deep text-white" : "border border-teal/30 text-teal-deep hover:bg-sand-deep"
                }`}
              >
                {m === "all" ? "All of these" : "Any of these"}
              </Link>
            ))}
          </nav>
        )}

        <Form action="/" scroll={false} className="flex items-end gap-2">
          {show !== "all" && <input type="hidden" name="show" value={show} />}
          {selected.length > 0 && <input type="hidden" name="ing" value={selected.join(",")} />}
          {match === "any" && <input type="hidden" name="match" value="any" />}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="add-ingredient" className="text-xs font-semibold text-ink-soft">
              {selected.length > 0 ? "Add another ingredient" : "Pick an ingredient"}
            </label>
            <select
              id="add-ingredient"
              name="add"
              defaultValue=""
              required
              className="w-full rounded-xl border border-teal bg-card px-3 py-2.5 text-base text-ink"
            >
              <option value="" disabled>
                Choose…
              </option>
              {groups.map((g) => (
                <optgroup key={g.family} label={g.family}>
                  {g.items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} — in {usageCounts[i.id]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-full bg-teal-deep px-4 py-2.5 text-sm font-bold text-white shadow-sm"
          >
            Add
          </button>
        </Form>

        <div className="flex min-h-5 items-center justify-between text-xs">
          {/* Always rendered so screen readers announce changes, incl. the first Add. */}
          <p role="status" className="text-ink-soft">
            {selected.length > 0 ? `${resultCount} ${resultCount === 1 ? "drink matches" : "drinks match"}` : ""}
          </p>
          {selected.length > 0 && (
            <Link href={listHref({ show })} scroll={false} className="font-semibold text-teal underline-offset-2 hover:underline">
              Clear ingredients
            </Link>
          )}
        </div>
        <p className="text-[11px] text-ink-faint">Numbers show how many of the 100 drinks use each ingredient.</p>
      </div>
    </details>
  );
}
