"use client";

import { useEffect } from "react";

// Set when the user acts inside the ingredient filter (Add, Remove, Clear,
// All/Any). Module-level so it survives the navigation/re-render (or remount)
// that follows.
let pendingFocus = false;

/**
 * After the ingredient filter changes, the control the user just used is
 * gone or replaced, so keyboard/screen-reader focus would fall back to the
 * page. Put it back on the picker (or the summary when the panel is closed).
 */
export function FilterFocus({ stateKey }: { stateKey: string }) {
  useEffect(() => {
    const details = document.getElementById("ingredient-filter");
    const mark = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (e.type === "submit" || t?.closest("a")) pendingFocus = true;
    };
    details?.addEventListener("click", mark);
    details?.addEventListener("submit", mark);
    return () => {
      details?.removeEventListener("click", mark);
      details?.removeEventListener("submit", mark);
    };
  }, []);

  useEffect(() => {
    if (!pendingFocus) return;
    pendingFocus = false;
    const details = document.getElementById("ingredient-filter") as HTMLDetailsElement | null;
    const target = details?.open
      ? document.getElementById("add-ingredient")
      : document.getElementById("ingredient-filter-summary");
    target?.focus({ preventScroll: true });
  }, [stateKey]);

  return null;
}
