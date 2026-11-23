"use client";

import { useEffect } from "react";
import { cardSlug, LIST_RETURN_KEY, parseListReturn, type ListReturn } from "@/lib/list-return";

const read = (): ListReturn | null => {
  try {
    return parseListReturn(window.sessionStorage.getItem(LIST_RETURN_KEY));
  } catch {
    return null;
  }
};
const write = (entry: ListReturn) => {
  try {
    window.sessionStorage.setItem(LIST_RETURN_KEY, JSON.stringify(entry));
  } catch {
    // Private mode or storage off: the list just opens at the top, as before.
  }
};

/**
 * On the home list: remembers where the taster was when they open a recipe
 * card, and puts them back there when they come back (via "← Back to the
 * list" or the browser's back button), with focus on the drink they opened.
 */
export function ListScrollMemory() {
  useEffect(() => {
    const here = window.location.pathname + window.location.search;

    // Coming back from a card: scroll to where they were, once.
    const saved = read();
    if (saved?.restore && saved.href === here) {
      write({ ...saved, restore: false });
      const row = saved.slug ? document.querySelector<HTMLAnchorElement>(`a[href="/cocktails/${saved.slug}"]`) : null;
      // After this frame's layout, so the list has its full height.
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved.y, behavior: "instant" });
        row?.focus({ preventScroll: true });
      });
    }

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      const slug = a ? cardSlug(a.getAttribute("href") ?? "") : null;
      if (!slug) return;
      write({ href: window.location.pathname + window.location.search, y: window.scrollY, slug, restore: false });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
