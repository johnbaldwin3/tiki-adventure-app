"use client";

import { useEffect, useRef } from "react";
import { SEARCH_MAX_LENGTH } from "@/lib/list";

/**
 * The home list's search input. Kept mounted across searches (so focus
 * stays put after pressing Search), with its value synced to the URL when
 * it changes from elsewhere (e.g. "Clear search", Back). After clearing,
 * focus comes back here since the "Clear search" link is gone.
 */
export function SearchBox({ q }: { q: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const prev = useRef(q);
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    if (document.activeElement !== input) input.value = q;
    if (prev.current !== "" && q === "" && document.activeElement === document.body) input.focus();
    prev.current = q;
  }, [q]);
  return (
    <input
      ref={ref}
      id="search"
      type="search"
      name="q"
      defaultValue={q}
      maxLength={SEARCH_MAX_LENGTH}
      autoComplete="off"
      enterKeyHint="search"
      placeholder="e.g. mai tai, falernum"
      className="w-full rounded-xl border border-teal bg-card px-3 py-2.5 text-base text-ink placeholder:text-ink-faint"
    />
  );
}
