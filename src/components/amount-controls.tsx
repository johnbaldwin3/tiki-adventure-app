import Link from "next/link";
import { UNIT_MODES, type UnitMode } from "@/lib/amounts";
import { UnitLink } from "./unit-link";

const SERVING_CHOICES = [1, 2, 3, 4, 6, 8];

function href(slug: string, servings: number, units: UnitMode | null) {
  const p = new URLSearchParams();
  if (servings !== 1) p.set("serves", String(servings));
  if (units) p.set("units", units);
  const qs = p.toString();
  return `/cocktails/${slug}${qs ? `?${qs}` : ""}`;
}

const pill = (active: boolean) =>
  `inline-flex min-h-8 min-w-10 items-center justify-center rounded-full px-2.5 text-xs font-semibold ${
    active ? "bg-teal-deep text-white" : "border border-teal/30 bg-card text-teal-deep hover:bg-sand-deep"
  }`;

/**
 * Servings (1x-8x) and units (as written / fl oz / ml) for the recipe
 * card's ingredient amounts. Plain links, so they work without JavaScript
 * and every view is a shareable URL. `urlUnits` is the unit in the URL (if
 * any), kept when changing servings.
 */
export function AmountControls({
  slug,
  servings,
  units,
  urlUnits,
}: {
  slug: string;
  servings: number;
  units: UnitMode;
  urlUnits: UnitMode | null;
}) {
  const choices = SERVING_CHOICES.includes(servings) ? SERVING_CHOICES : [...SERVING_CHOICES, servings].sort((a, b) => a - b);
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div role="group" aria-label="Servings" className="flex flex-wrap items-center gap-1.5">
        <span aria-hidden="true" className="mr-1 text-xs text-ink-soft">
          Make
        </span>
        {choices.map((n) => (
          <Link
            key={n}
            href={href(slug, n, urlUnits)}
            scroll={false}
            prefetch={false}
            aria-current={n === servings ? "true" : undefined}
            className={pill(n === servings)}
          >
            {n}
            <span aria-hidden="true">×</span>
            <span className="sr-only"> {n === 1 ? "drink" : "drinks"}</span>
          </Link>
        ))}
      </div>
      <div role="group" aria-label="Units" className="flex flex-wrap items-center gap-1.5">
        <span aria-hidden="true" className="mr-1 text-xs text-ink-soft">
          Show
        </span>
        {UNIT_MODES.map((m) => (
          <UnitLink
            key={m.value}
            href={href(slug, servings, m.value)}
            mode={m.value}
            current={m.value === units}
            className={pill(m.value === units)}
          >
            {m.label}
          </UnitLink>
        ))}
      </div>
    </div>
  );
}
