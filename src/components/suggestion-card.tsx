import Link from "next/link";
import { getIngredient } from "@/lib/ingredients";
import type { Suggestion, SuggestDrink } from "@/lib/suggest";

/** Catalog name for prose: keeps its casing, drops notes in brackets ("Aged Jamaican rum (funky)" -> "Aged Jamaican rum"). */
export function shortIngredientName(id: string): string {
  const name = getIngredient(id)?.name ?? id;
  return name.replace(/\s*\([^)]*\)/g, "").trim();
}

function joinNames(ids: string[]): string {
  const names = ids.slice(0, 2).map(shortIngredientName);
  return names.length === 2 ? `${names[0]} and ${names[1]}` : names[0];
}

/** Why a drink is suggested, in plain words. */
export function suggestionReasons(s: Suggestion<SuggestDrink>): string[] {
  const reasons: string[] = [];
  if (s.missing?.length === 0) reasons.push("We can make it now");
  else if (s.missing?.length === 1) reasons.push(`Just need ${shortIngredientName(s.missing[0])}`);
  if (s.like && s.like.shared.length > 0) {
    reasons.push(`Like ${s.like.drink.name} (our ${s.like.drink.avgRating}): both use ${joinNames(s.like.shared)}`);
  }
  if (reasons.length === 0) reasons.push(`#${s.drink.diffordsRank} on Difford's list`);
  return reasons;
}

/** One suggested drink: its name links to the recipe card; the reasons sit below as plain text. */
export function SuggestionCard({ s }: { s: Suggestion<SuggestDrink> }) {
  const reasons = suggestionReasons(s);
  return (
    <div className="flex flex-col rounded-xl bg-card p-3 shadow-sm">
      <Link
        href={`/cocktails/${s.drink.slug}`}
        prefetch={false}
        className="w-fit text-sm font-semibold text-teal-deep underline-offset-2 hover:underline"
      >
        {s.drink.name} <span aria-hidden="true">›</span>
      </Link>
      {reasons.map((r) => (
        <span key={r} className="text-xs text-ink-soft">
          {r.startsWith("We can make") && <span aria-hidden="true">✓ </span>}
          {r}
        </span>
      ))}
    </div>
  );
}
