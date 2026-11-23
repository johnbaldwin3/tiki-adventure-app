"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { backLabel, LIST_RETURN_KEY, parseListReturn, type ListReturn } from "@/lib/list-return";

const subscribe = () => () => {};
const getRaw = () => {
  try {
    return window.sessionStorage.getItem(LIST_RETURN_KEY);
  } catch {
    return null;
  }
};
const markRestore = (entry: ListReturn | null) => {
  if (!entry) return;
  try {
    window.sessionStorage.setItem(LIST_RETURN_KEY, JSON.stringify({ ...entry, restore: true }));
  } catch {
    // Storage off: the list opens at the top.
  }
};

/**
 * "← All cocktails" on a recipe card. If the taster came from the home list,
 * it goes back to that list with its filters and scroll position
 * (ListScrollMemory on the home page does the scrolling). The browser's back
 * button gets the same treatment.
 */
export function BackToList({ className }: { className?: string }) {
  // Server render (and first paint) is the plain link; the remembered list
  // is read from this tab's sessionStorage once hydrated.
  const raw = useSyncExternalStore(subscribe, getRaw, () => null);
  const entry = parseListReturn(raw);

  useEffect(() => {
    // Browser back from the card: popstate fires here, before the list renders.
    const onPop = () => {
      const here = parseListReturn(getRaw());
      if (here && here.href === window.location.pathname + window.location.search) markRestore(here);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <Link
      href={entry?.href ?? "/"}
      scroll={entry ? false : undefined}
      onClick={() => markRestore(entry)}
      className={className}
    >
      <span aria-hidden="true">←</span> {backLabel(entry)}
    </Link>
  );
}
