"use client";

import { useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** An invite link you can select, copy, or (on phones) share. */
export function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  // false on the server and during hydration, then the real answer.
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        readOnly
        value={url}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full min-w-0 rounded-xl border border-teal/30 bg-sand px-3 py-2 font-mono text-xs text-ink"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className="rounded-full bg-teal-deep px-3 py-1.5 text-sm font-bold text-white shadow-sm">
          Copy link
        </button>
        {canShare && (
          <button
            type="button"
            onClick={() => navigator.share({ title: "Join me on Equal Parts", url }).catch(() => {})}
            className="rounded-full border border-teal/30 px-3 py-1.5 text-sm font-semibold text-teal-deep"
          >
            Share…
          </button>
        )}
        <span role="status" className="text-sm text-teal-deep">
          {copied ? "Copied!" : ""}
        </span>
      </div>
    </div>
  );
}
