import Link from "next/link";
import type { ScCategory } from "@/data/smugglers-cove";

/**
 * A Smuggler's Cove rum category: the book's numbered circle (1-8) like the
 * icons in its recipes, plus the name unless `compact`. Links to the rum
 * guide. `approx` marks our closest match (not listed in the book).
 */
export function RumBadge({
  category,
  compact = false,
  approx = false,
  link = true,
}: {
  category: ScCategory;
  compact?: boolean;
  approx?: boolean;
  link?: boolean;
}) {
  const label = `Smuggler's Cove ${category.number ? `rum number ${category.number}, ` : "rum category "}${category.name}${approx ? " (our closest match)" : ""}`;
  const body = (
    <>
      {approx && <span aria-hidden="true">≈</span>}
      {category.number ? (
        <span
          aria-hidden="true"
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold leading-none text-white"
        >
          {category.number}
        </span>
      ) : (
        <span aria-hidden="true" className="text-[10px] font-bold uppercase tracking-wide">
          SC
        </span>
      )}
      {!compact && <span aria-hidden="true">{category.name}</span>}
      <span className="sr-only">{label}</span>
    </>
  );
  const cls = `inline-flex items-center gap-1 rounded-full border border-ink/30 bg-card px-1.5 py-0.5 text-xs font-semibold text-ink ${
    compact ? "whitespace-nowrap" : "text-left"
  }`;
  return link ? (
    <Link href={`/rums#${category.id}`} prefetch={false} className={`${cls} hover:bg-sand-deep`}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}
