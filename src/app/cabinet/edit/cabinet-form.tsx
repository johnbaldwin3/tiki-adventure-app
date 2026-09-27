"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { BOTTLE_MAX_LENGTH } from "@/lib/cabinet";
import { saveCabinet, type CabinetFormState } from "../actions";

export interface CabinetFormGroup {
  family: string;
  items: { id: string; name: string; brands: string[] }[];
}

interface Props {
  groups: CabinetFormGroup[];
  /** What's in the cabinet now: ingredient id -> exact bottle (or null). */
  saved: Record<string, string | null>;
}

export function CabinetForm({ groups, saved }: Props) {
  const [state, formAction, pending] = useActionState<CabinetFormState, FormData>(saveCabinet, {
    submission: 0,
    values: null,
    message: null,
  });

  // After a failed save, show exactly what was submitted (nothing typed is lost).
  const have = new Set(state.values ? state.values.have : Object.keys(saved));
  const bottleFor = (id: string) => (state.values ? (state.values.bottles[id] ?? "") : (saved[id] ?? ""));

  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.submission > 0) messageRef.current?.focus();
  }, [state.submission]);

  return (
    // key: re-mount after a failed submit so inputs show the echoed values.
    <form key={state.submission} action={formAction} className="flex flex-col gap-4">
      {state.message && (
        <p
          ref={messageRef}
          tabIndex={-1}
          role="alert"
          className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm"
        >
          {state.message}
        </p>
      )}

      {/* What was in the cabinet when this page loaded, so only real changes are saved. */}
      {Object.entries(saved).map(([id, bottle]) => (
        <span key={id} hidden>
          <input type="hidden" name="was" value={id} />
          <input type="hidden" name={`was-bottle:${id}`} value={bottle ?? ""} />
        </span>
      ))}

      {groups.map((g) => {
        const owned = g.items.filter((i) => have.has(i.id)).length;
        return (
          <details key={g.family} open={owned > 0} className="rounded-2xl bg-card shadow-sm">
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-teal-deep">
              {g.family}
              <span className="font-normal text-ink-soft">
                {" "}
                · {owned} of {g.items.length}
              </span>
            </summary>
            <fieldset className="border-t border-teal/10 px-4 pb-2">
              <legend className="sr-only">{g.family}</legend>
              <ul className="flex flex-col divide-y divide-teal/10">
                {g.items.map((i) => {
                  const cbId = `have-${i.id}`;
                  const bottleId = `bottle-${i.id}`;
                  const listId = `brands-${i.id}`;
                  return (
                    <li key={i.id} className="group py-2.5">
                      <label htmlFor={cbId} className="flex items-start gap-3">
                        <input
                          id={cbId}
                          type="checkbox"
                          name="have"
                          value={i.id}
                          defaultChecked={have.has(i.id)}
                          className="mt-0.5 h-5 w-5 shrink-0 accent-teal-deep"
                        />
                        <span className="flex flex-col">
                          <span className="text-sm font-semibold text-ink">{i.name}</span>
                          {i.brands.length > 0 && (
                            <span className="text-xs text-ink-faint">e.g. {i.brands.slice(0, 3).join(", ")}</span>
                          )}
                        </span>
                      </label>
                      {/* Revealed (no JavaScript needed) once the box is ticked. */}
                      <div className="mt-2 hidden pl-8 group-has-checked:block">
                        <label htmlFor={bottleId} className="text-xs font-semibold text-ink-soft">
                          Which bottle<span className="sr-only"> of {i.name}</span>?{" "}
                          <span className="font-normal">(optional)</span>
                        </label>
                        <input
                          id={bottleId}
                          name={`bottle:${i.id}`}
                          type="text"
                          maxLength={BOTTLE_MAX_LENGTH}
                          autoComplete="off"
                          list={i.brands.length > 0 ? listId : undefined}
                          defaultValue={bottleFor(i.id)}
                          className="mt-1 w-full rounded-xl border border-teal bg-card px-3 py-2 text-base text-ink"
                        />
                        {i.brands.length > 0 && (
                          <datalist id={listId}>
                            {i.brands.map((b) => (
                              <option key={b} value={b} />
                            ))}
                          </datalist>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          </details>
        );
      })}

      {/* Sticky (not fixed) so it never covers a focused field inside the form. */}
      <div className="sticky bottom-0 -mx-4 border-t border-teal/15 bg-sand/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="flex gap-3">
          <Link
            href="/cabinet"
            className="flex-1 rounded-full border border-teal/30 bg-card px-4 py-3 text-center text-base font-semibold text-teal-deep"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-full bg-teal-deep px-4 py-3 text-base font-bold text-white shadow-sm disabled:opacity-70"
          >
            {pending ? "Saving…" : "Save our bar"}
          </button>
        </div>
      </div>
    </form>
  );
}
