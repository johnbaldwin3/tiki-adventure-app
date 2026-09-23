"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { NOTES_MAX_LENGTH, type TastingFormValues } from "@/lib/tasting-form";
import { saveTasting, type TastingFormState } from "./actions";

interface Props {
  slug: string;
  taster: string; // lowercase initials, e.g. "jb"
  initialValues: TastingFormValues;
  today: string;
  writesEnabled: boolean;
}

const fieldClass =
  // border-teal on white is ~6:1, clearing WCAG 1.4.11's 3:1 for field outlines.
  "w-full rounded-xl border bg-card px-3 py-2.5 text-base text-ink shadow-sm focus:outline-2 focus:outline-offset-1 focus:outline-teal";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm font-semibold text-coral-deep">
      {message}
    </p>
  );
}

export function TastingForm({ slug, taster, initialValues, today, writesEnabled }: Props) {
  const [state, formAction, pending] = useActionState<TastingFormState, FormData>(saveTasting, {
    status: "idle",
    submission: 0,
    values: initialValues,
    errors: {},
    message: null,
  });
  const v = state.values;
  const e = state.errors;
  const border = (field: keyof TastingFormValues) =>
    e[field] ? "border-2 border-coral-deep" : "border-teal";

  // After a submit the form re-mounts (see key below), which drops focus.
  // Move it somewhere useful: the first invalid field, else the message.
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.submission === 0) return;
    const firstInvalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (firstInvalid ?? messageRef.current)?.focus();
  }, [state.submission]);

  return (
    // key: re-mount after each submit so inputs show exactly the values the
    // server echoed back, and the status message is announced again even if
    // it's the same text as last time.
    <form
      key={state.submission}
      ref={formRef}
      action={formAction}
      noValidate
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="taster" value={taster} />

      {!writesEnabled && (
        <p className="rounded-2xl border border-teal/25 bg-sand-deep p-3 text-sm text-teal-deep">
          <strong>Preview mode.</strong> You can try the form, but saving is turned off until
          sign-in is added.
        </p>
      )}

      {state.message && (
        <p
          ref={messageRef}
          tabIndex={-1}
          role={state.status === "preview" ? "status" : "alert"}
          className={`rounded-2xl border bg-card p-3 text-sm shadow-sm ${
            state.status === "preview"
              ? "border-teal/30 text-teal-deep"
              : "border-coral/30 text-coral-deep"
          }`}
        >
          {state.message}
        </p>
      )}

      <div>
        <label className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm">
          <input
            type="checkbox"
            name="tried"
            defaultChecked={v.tried}
            aria-invalid={!!e.tried}
            aria-describedby={e.tried ? "tried-error" : undefined}
            className="h-5 w-5 accent-teal-deep"
          />
          <span className="text-base font-semibold text-ink">I&apos;ve tried this</span>
        </label>
        <FieldError id="tried-error" message={e.tried} />
      </div>

      <div>
        <label htmlFor="rating" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          Rating
        </label>
        <p id="rating-hint" className="text-xs text-ink-faint">
          0 to 10, up to 2 decimals. Leave blank if you haven&apos;t rated it.
        </p>
        <input
          id="rating"
          name="rating"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="e.g. 8.75"
          defaultValue={v.rating}
          aria-invalid={!!e.rating}
          aria-describedby={`rating-hint${e.rating ? " rating-error" : ""}`}
          className={`mt-1.5 ${fieldClass} ${border("rating")}`}
        />
        <FieldError id="rating-error" message={e.rating} />
      </div>

      <div>
        <label htmlFor="tastedAt" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          Date tasted
        </label>
        <input
          id="tastedAt"
          name="tastedAt"
          type="date"
          max={today}
          defaultValue={v.tastedAt}
          aria-invalid={!!e.tastedAt}
          aria-describedby={e.tastedAt ? "tastedAt-error" : undefined}
          className={`mt-1.5 ${fieldClass} ${border("tastedAt")}`}
        />
        <FieldError id="tastedAt-error" message={e.tastedAt} />
      </div>

      <div>
        <label htmlFor="notes" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={5}
          maxLength={NOTES_MAX_LENGTH}
          placeholder="What stood out? Would you make it again?"
          defaultValue={v.notes}
          aria-invalid={!!e.notes}
          aria-describedby={e.notes ? "notes-error" : undefined}
          className={`mt-1.5 ${fieldClass} ${border("notes")}`}
        />
        <FieldError id="notes-error" message={e.notes} />
      </div>

      <div className="flex gap-3">
        <Link
          href={`/cocktails/${slug}#tasting`}
          className="flex-1 rounded-full border border-teal/30 bg-card px-4 py-3 text-center text-base font-semibold text-teal-deep shadow-sm"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-full bg-teal-deep px-4 py-3 text-base font-bold text-white shadow-sm disabled:opacity-70"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
