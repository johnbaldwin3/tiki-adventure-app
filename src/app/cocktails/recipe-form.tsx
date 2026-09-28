"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { fieldClass } from "@/components/form-field";
import { LIMITS, type RecipeDraft, type RecipeLine } from "@/lib/recipe-form";
import { saveRecipe, type SaveState } from "./recipe-actions";

export interface CatalogGroup {
  family: string;
  items: { id: string; name: string }[];
}

interface Props {
  initial: RecipeDraft;
  catalog: CatalogGroup[];
  /** Set when editing an existing recipe (its slug never changes). */
  editSlug?: string;
  /** Things the recipe helper wasn't sure about. */
  warnings?: string[];
  cancelHref: string;
}


function Err({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm font-semibold text-coral-deep">
      {message}
    </p>
  );
}

/**
 * Review / edit form for one of our own recipes. Every field is editable;
 * ingredient rows can be added and removed, and each can be matched to an
 * ingredient style from our catalog (so our bar, the shopping list and the
 * ingredient filter understand it).
 */
export function RecipeForm({ initial, catalog, editSlug, warnings = [], cancelHref }: Props) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveRecipe, {
    submission: 0,
    draft: initial,
    errors: {},
  });
  const d = state.draft;
  const e = state.errors;
  // Row keys are deterministic (submission + position, or "n<count>" for
  // added rows), and ids combine useId() with the key, so the server and
  // the browser render the same ids.
  const uid = useId();
  const [added, setAdded] = useState(0);
  const startLines = (gen: number) =>
    (d.ingredients.length > 0 ? d.ingredients : [{ amount: "", unit: "", ingredient: "", catalogId: "" }]).map(
      (l: RecipeLine, i: number) => ({ ...l, key: `${gen}-${i}` })
    );
  const [lines, setLines] = useState(() => startLines(state.submission));
  // After a failed save, show exactly the rows that were submitted.
  const [linesFor, setLinesFor] = useState(state.submission);
  if (linesFor !== state.submission) {
    setLinesFor(state.submission);
    setLines(startLines(state.submission));
  }

  // After a failed save the form re-mounts with the echoed values (key
  // below); move focus to the first problem so it's announced.
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.submission === 0) return;
    const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (first ?? messageRef.current)?.focus();
  }, [state.submission]);

  const invalid = (field: keyof typeof e) => (e[field] ? "border-2 border-coral-deep" : "border-teal");

  const [announcement, setAnnouncement] = useState("");

  return (
    <form key={state.submission} ref={formRef} action={formAction} noValidate className="flex flex-col gap-5 pb-4">
      {editSlug && <input type="hidden" name="editSlug" value={editSlug} />}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <input type="hidden" name="lines" value={lines.length} />

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-ink shadow-sm">
          <p className="font-semibold text-coral-deep">Check these before saving:</p>
          <ul className="mt-1 list-disc pl-5 text-ink-soft">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {(e.form || Object.keys(e).length > 0) && (
        <p
          ref={messageRef}
          tabIndex={-1}
          role="alert"
          className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm"
        >
          {e.form ??
            [e.name, e.ingredients, e.lines && "Some ingredients need a name.", e.sourceUrl].filter(Boolean).join(" ")}
        </p>
      )}

      <div>
        <label htmlFor="name" className="text-sm font-semibold text-ink">
          Name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={d.name}
          maxLength={LIMITS.name}
          required
          aria-invalid={e.name ? true : undefined}
          aria-describedby={e.name ? "name-error" : undefined}
          className={`mt-1 ${fieldClass} ${invalid("name")}`}
        />
        <Err id="name-error" message={e.name} />
      </div>

      <fieldset className="flex flex-col gap-3" aria-describedby={e.ingredients ? "ingredients-error" : undefined}>
        <legend className="text-sm font-semibold text-ink">Ingredients</legend>
        <p className="-mt-1 text-xs text-ink-faint">
          In pour order. Add “(optional)” to an ingredient that&apos;s optional. Matching a style lets our bar and
          shopping list understand it.
        </p>
        {e.ingredients && (
          <p id="ingredients-error" className="text-sm font-semibold text-coral-deep">
            {e.ingredients}
          </p>
        )}
        <ol className="flex flex-col gap-3">
          {lines.map((l, i) => {
            const lineError = e.lines?.[i];
            const n = i + 1;
            return (
              <li key={l.key} className="rounded-2xl bg-card p-3 shadow-sm">
                <fieldset>
                  <legend className="text-xs font-bold uppercase tracking-wide text-ink-soft">Ingredient {n}</legend>
                  <div className="mt-2 grid grid-cols-[5rem_5rem_1fr] gap-2">
                    <div>
                      <label htmlFor={`${uid}-${l.key}-amount`} className="text-xs text-ink-soft">
                        Amount
                      </label>
                      <input
                        id={`${uid}-${l.key}-amount`}
                        name={`line-${i}-amount`}
                        defaultValue={l.amount}
                        maxLength={LIMITS.amount}
                        inputMode="text"
                        className={`mt-1 ${fieldClass} border-teal px-2`}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${uid}-${l.key}-unit`} className="text-xs text-ink-soft">
                        Unit
                      </label>
                      <input
                        id={`${uid}-${l.key}-unit`}
                        name={`line-${i}-unit`}
                        defaultValue={l.unit}
                        maxLength={LIMITS.unit}
                        placeholder="fl oz"
                        className={`mt-1 ${fieldClass} border-teal px-2`}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${uid}-${l.key}-ingredient`} className="text-xs text-ink-soft">
                        Ingredient
                      </label>
                      <input
                        id={`${uid}-${l.key}-ingredient`}
                        name={`line-${i}-ingredient`}
                        defaultValue={l.ingredient}
                        maxLength={LIMITS.ingredient}
                        aria-invalid={lineError ? true : undefined}
                        aria-describedby={lineError ? `${uid}-${l.key}-error` : undefined}
                        className={`mt-1 ${fieldClass} ${lineError ? "border-2 border-coral-deep" : "border-teal"} px-2`}
                      />
                    </div>
                  </div>
                  <Err id={`${uid}-${l.key}-error`} message={lineError} />
                  <div className="mt-2 flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`${uid}-${l.key}-catalog`} className="text-xs text-ink-soft">
                        Style in our catalog
                      </label>
                      <select
                        id={`${uid}-${l.key}-catalog`}
                        name={`line-${i}-catalog`}
                        defaultValue={l.catalogId}
                        className={`mt-1 ${fieldClass} border-teal px-2`}
                      >
                        <option value="">Not in our catalog</option>
                        {catalog.map((g) => (
                          <optgroup key={g.family} label={g.family}>
                            {g.items.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = lines[i + 1] ?? lines[i - 1];
                        setLines((ls) => ls.filter((x) => x.key !== l.key));
                        // Keep keyboard focus nearby once the row is gone.
                        requestAnimationFrame(() => document.getElementById(`${uid}-${next?.key}-amount`)?.focus());
                        setAnnouncement(`Ingredient ${n} removed.`);
                      }}
                      disabled={lines.length === 1}
                      className="shrink-0 rounded-full px-3 py-2.5 text-xs font-semibold text-ink-soft underline underline-offset-2 disabled:opacity-50"
                    >
                      Remove<span className="sr-only"> ingredient {n}</span>
                    </button>
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ol>
        {lines.length < LIMITS.ingredients && (
          <button
            type="button"
            onClick={() => {
              setLines((ls) => [...ls, { amount: "", unit: "", ingredient: "", catalogId: "", key: `n${added}` }]);
              setAdded((c) => c + 1);
              // Focus the new row's first field once it renders.
              requestAnimationFrame(() => {
                const inputs = formRef.current?.querySelectorAll<HTMLInputElement>('input[name$="-amount"]');
                inputs?.[inputs.length - 1]?.focus();
              });
            }}
            className="w-fit rounded-full border border-teal/30 bg-card px-4 py-2 text-sm font-semibold text-teal-deep"
          >
            + Add an ingredient
          </button>
        )}
      </fieldset>

      <div>
        <label htmlFor="method" className="text-sm font-semibold text-ink">
          Method
        </label>
        <textarea
          id="method"
          name="method"
          defaultValue={d.method}
          maxLength={LIMITS.method}
          rows={3}
          className={`mt-1 ${fieldClass} border-teal`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="glass" className="text-sm font-semibold text-ink">
            Glass
          </label>
          <input id="glass" name="glass" defaultValue={d.glass} maxLength={LIMITS.glass} className={`mt-1 ${fieldClass} border-teal`} />
        </div>
        <div>
          <label htmlFor="garnish" className="text-sm font-semibold text-ink">
            Garnish
          </label>
          <input
            id="garnish"
            name="garnish"
            defaultValue={d.garnish}
            maxLength={LIMITS.garnish}
            className={`mt-1 ${fieldClass} border-teal`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="primarySpirits" className="text-sm font-semibold text-ink">
          Main spirits <span className="font-normal text-ink-soft">(comma-separated)</span>
        </label>
        <input
          id="primarySpirits"
          name="primarySpirits"
          defaultValue={d.primarySpirits}
          placeholder="e.g. Jamaican rum, Demerara rum"
          className={`mt-1 ${fieldClass} border-teal`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sourceNote" className="text-sm font-semibold text-ink">
            Where it&apos;s from <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input
            id="sourceNote"
            name="sourceNote"
            defaultValue={d.sourceNote}
            maxLength={LIMITS.sourceNote}
            placeholder="e.g. Smuggler's Cove, p. 112"
            className={`mt-1 ${fieldClass} border-teal`}
          />
        </div>
        <div>
          <label htmlFor="sourceUrl" className="text-sm font-semibold text-ink">
            Link <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            defaultValue={d.sourceUrl}
            maxLength={LIMITS.sourceUrl}
            aria-invalid={e.sourceUrl ? true : undefined}
            aria-describedby={e.sourceUrl ? "sourceUrl-error" : undefined}
            className={`mt-1 ${fieldClass} ${invalid("sourceUrl")}`}
          />
          <Err id="sourceUrl-error" message={e.sourceUrl} />
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="isGuess"
          defaultChecked={d.isGuess}
          className="mt-0.5 size-5 shrink-0 accent-teal-deep"
        />
        <span>
          <span className="font-semibold">This is a best guess</span>{" "}
          <span className="text-ink-soft">(amounts not tested yet — shows a &ldquo;Best guess&rdquo; badge)</span>
        </span>
      </label>

      <div className="flex gap-3">
        <Link
          href={cancelHref}
          className="flex-1 rounded-full border border-teal/30 bg-card px-4 py-3 text-center text-base font-semibold text-teal-deep"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-full bg-teal-deep px-4 py-3 text-base font-bold text-white shadow-sm disabled:opacity-70"
        >
          {pending ? "Saving…" : editSlug ? "Save changes" : "Save recipe"}
        </button>
      </div>
    </form>
  );
}
