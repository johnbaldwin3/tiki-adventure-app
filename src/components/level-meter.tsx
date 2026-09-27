import { fractionLeft, isLow, type BottleLevel } from "@/lib/inventory";

/** A small bottle-level bar (decorative; the text next to it says the amount). */
export function LevelMeter({ level }: { level: BottleLevel }) {
  const f = fractionLeft(level);
  if (f === null) return null;
  return (
    <span aria-hidden="true" className="inline-block h-2 w-16 overflow-hidden rounded-full bg-teal/15 align-middle">
      <span
        className={`block h-full rounded-full ${isLow(level) ? "bg-coral-deep" : "bg-teal-deep"}`}
        style={{ width: `${Math.round(f * 100)}%` }}
      />
    </span>
  );
}
