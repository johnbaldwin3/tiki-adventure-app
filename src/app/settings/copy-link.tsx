"use client";

import { useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * An invite link you can select, copy, email (prefilled, in your default mail
 * app), copy as a whole email (for any other email service) or, on phones, share.
 */
export function CopyLink({ url, label, mailto, emailText }: { url: string; label: string; mailto?: string; emailText?: string }) {
  const [copied, setCopied] = useState<"" | "link" | "email">("");
  // false on the server and during hydration, then the real answer.
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);

  async function copy(text: string, what: "link" | "email") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 2500);
    } catch {
      setCopied("");
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
        <button type="button" onClick={() => copy(url, "link")} className="rounded-full bg-teal-deep px-3 py-1.5 text-sm font-bold text-white shadow-sm">
          Copy link
        </button>
        {mailto && (
          <a href={mailto} className="rounded-full border border-teal/30 px-3 py-1.5 text-sm font-semibold text-teal-deep">
            Email it
          </a>
        )}
        {emailText && (
          <button
            type="button"
            onClick={() => copy(emailText, "email")}
            className="rounded-full border border-teal/30 px-3 py-1.5 text-sm font-semibold text-teal-deep"
          >
            Copy email
          </button>
        )}
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
          {copied === "link" ? "Link copied!" : copied === "email" ? "Email copied! Paste it into any email." : ""}
        </span>
      </div>
    </div>
  );
}
