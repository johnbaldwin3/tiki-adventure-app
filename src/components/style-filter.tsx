import Link from "next/link";
import { listHref, type IngredientMatch, type ListFilter } from "@/lib/list";
import { STYLE_GROUPS, STYLE_TAGS } from "@/lib/styles";

/**
 * "Filter by style" for the home list: tag chips (style, base spirit,
 * flavor) that toggle on and off; a drink must have every chosen tag.
 * Plain links, so every state is a shareable URL and it works without JS.
 * Counts are drinks in the current view that have the tag.
 */
export function StyleFilter({
  c,
  q,
  show,
  ing,
  match,
  selected,
  counts,
}: {
  c: string | null;
  q: string;
  show: ListFilter;
  ing: string[];
  match: IngredientMatch;
  selected: string[];
  counts: Record<string, number>;
}) {
  const href = (style: string[]) => listHref({ c, q, show, ing, match, style });
  return (
    <details open={selected.length > 0 || undefined} className="rounded-2xl bg-card p-3 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold text-teal-deep">
        Filter by style{selected.length > 0 ? ` (${selected.length})` : ""}
      </summary>
      <nav aria-label="Style tags" className="mt-2 flex flex-col gap-2">
        {STYLE_GROUPS.map((g) => (
          <div key={g.group} role="group" aria-labelledby={`style-group-${g.group}`}>
            <p id={`style-group-${g.group}`} className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {g.label}
            </p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {STYLE_TAGS.filter((t) => t.group === g.group).map((t) => {
                const on = selected.includes(t.id);
                const n = counts[t.id] ?? 0;
                if (!on && n === 0) return null;
                return (
                  <li key={t.id}>
                    <Link
                      href={href(on ? selected.filter((s) => s !== t.id) : [...selected, t.id])}
                      scroll={false}
                      className={`inline-block rounded-full px-3 py-1.5 text-xs font-semibold ${
                        on ? "bg-teal-deep text-white" : "border border-teal/30 text-teal-deep hover:bg-sand-deep"
                      }`}
                    >
                      {on && <span aria-hidden="true">✓ </span>}
                      {t.label}
                      {!on && <span aria-hidden="true" className="text-ink-faint"> {n}</span>}
                      <span className="sr-only">{on ? " (chosen; select to remove)" : ` (${n} ${n === 1 ? "drink" : "drinks"}; select to add)`}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {selected.length > 0 && (
          <Link href={href([])} scroll={false} className="w-fit text-xs font-semibold text-teal underline underline-offset-2">
            Clear styles
          </Link>
        )}
      </nav>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-teal underline-offset-2 hover:underline">
          How tags are worked out
        </summary>
        <p className="mt-1 text-xs text-ink-soft">
          From each recipe&apos;s ingredients and amounts (we can fix any drink on its card). Each drink gets one build.
        </p>
        <dl className="mt-1 grid gap-1 text-xs text-ink-soft">
          {STYLE_TAGS.map((t) => (
            <div key={t.id}>
              <dt className="inline font-semibold text-ink">{t.label}:</dt> <dd className="inline">{t.rule}</dd>
            </div>
          ))}
        </dl>
      </details>
    </details>
  );
}
