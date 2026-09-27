import Link from "next/link";
import { addToShopping, removeFromShopping } from "@/app/shopping/actions";
import { FocusMessage } from "./focus-message";

const pill =
  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold";

/**
 * Add-to / on-the-shopping-list control for one or more ingredients. A plain
 * form, so it works without JavaScript; the action redirects back to
 * `returnTo`.
 */
export function ShoppingButton({
  ids,
  onList,
  returnTo,
  label = "Add to shopping list",
  itemName,
}: {
  ids: string[];
  onList: boolean;
  returnTo: string;
  label?: string;
  /** For screen readers when several buttons share a page, e.g. "Falernum". */
  itemName?: string;
}) {
  // With several buttons on a page, the item name goes in the accessible name.
  const named = (visible: string) =>
    itemName ? `${visible}: ${itemName}` : undefined;
  if (onList) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Link
          href="/shopping"
          aria-label={named("On the shopping list")}
          className={`${pill} border border-teal/30 bg-sand text-teal-deep`}
        >
          <span aria-hidden="true">✓</span> On the shopping list
        </Link>
        <form action={removeFromShopping}>
          {ids.map((id) => (
            <input key={id} type="hidden" name="id" value={id} />
          ))}
          <input type="hidden" name="returnTo" value={returnTo} />
          <button
            type="submit"
            aria-label={named("Remove")}
            className={`${pill} text-ink-soft underline underline-offset-2`}
          >
            Remove
          </button>
        </form>
      </span>
    );
  }
  return (
    <form action={addToShopping}>
      {ids.map((id) => (
        <input key={id} type="hidden" name="id" value={id} />
      ))}
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        aria-label={named(label)}
        className={`${pill} bg-teal-deep text-white shadow-sm`}
      >
        <span aria-hidden="true">+</span> {label}
      </button>
    </form>
  );
}

const MESSAGES: Record<string, string> = {
  added: "Added to the shopping list.",
  removed: "Removed from the shopping list.",
  bought: "Moved to our bar.",
};

/**
 * Result of a shopping-list action (?shopping=added|removed|bought|error),
 * focused on arrival. `here` is the page it's shown on, so it doesn't link
 * to itself.
 */
export function ShoppingStatus({
  status,
  here,
}: {
  status: string | string[] | undefined;
  here?: string;
}) {
  const s = typeof status === "string" ? status : undefined;
  if (!s) return null;
  if (s === "error") {
    return (
      <FocusMessage
        role="alert"
        className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm"
      >
        Couldn&apos;t update the shopping list. Please try again.
      </FocusMessage>
    );
  }
  if (!MESSAGES[s]) return null;
  const link =
    s === "bought"
      ? { href: "/cabinet", label: "See our bar" }
      : { href: "/shopping", label: "See the list" };
  return (
    <FocusMessage
      role="status"
      className="rounded-2xl border border-teal/30 bg-card p-3 text-sm text-teal-deep shadow-sm"
    >
      {MESSAGES[s]}{" "}
      {link.href !== here && (
        <Link
          href={link.href}
          className="font-semibold underline underline-offset-2"
        >
          {link.label}
        </Link>
      )}
    </FocusMessage>
  );
}
