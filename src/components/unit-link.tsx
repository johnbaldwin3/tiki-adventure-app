"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { UNITS_COOKIE, type UnitMode } from "@/lib/amounts";

/**
 * A unit choice on the recipe card. Picking one remembers it (a cookie set
 * here, on click -- never by a prefetch) so other cards open in it too.
 */
export function UnitLink({
  href,
  mode,
  className,
  current,
  children,
}: {
  href: string;
  mode: UnitMode;
  className: string;
  current: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      prefetch={false}
      aria-current={current ? "true" : undefined}
      className={className}
      onClick={() => {
        const secure = window.location.protocol === "https:" ? "; secure" : "";
        document.cookie = `${UNITS_COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax${secure}`;
      }}
    >
      {children}
    </Link>
  );
}
