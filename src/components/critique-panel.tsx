"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { critiqueRecipe, saveTrial, type CritiqueState } from "@/app/cocktails/critique-actions";
import { CRITIQUE_LIMITS, CRITIQUES, diffLines, proposalReasoning, proposedMethod } from "@/lib/critique";
import { LIMITS } from "@/lib/recipe-form";
import { fieldClass } from "./form-field";
import { SubmitButton } from "./submit-button";

const INITIAL: CritiqueState = { submission: 0, status: "idle", message: null, proposal: null, before: [], critique: "" };

const KIND_LABEL = { changed: "Changed", added: "Added", removed: "Removed", same: "Same" } as const;

/**
 * "How was it?" (tasters only): pick what was off and/or say it in a few
 * words; the recipe helper suggests small changes with reasons. Nothing is
 * saved until "Save as a trial" (amounts and method can be edited first).
 */
export function CritiquePanel({
  slug,
  name,
  method,
  base,
  trialId,
}: {
  slug: string;
  name: string;
  /** The method of the version being critiqued. */
  method: string | null;
  /** What's being critiqued: our current recipe, or the trial we're trying. */
  base: "current" | "trial";
  /** The trial we're trying now, if any (a new trial replaces it). */
  trialId: string | null;
}) {
  const [state, action, pending] = useActionState(critiqueRecipe, INITIAL);
  const uid = useId();
  const messageRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state.submission === 0) return;
    (state.proposal ? headingRef.current : messageRef.current)?.focus();
  }, [state.submission, state.proposal]);

  const p = state.proposal;
  const changes = p ? diffLines(state.before, p.ingredients).filter((d) => d.kind !== "same") : [];

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="base" value={base} />
        <fieldset>
          <legend className="text-sm font-semibold text-ink">{base === "trial" ? "How was the trial?" : `How was the ${name}?`}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CRITIQUES.map((c) => (
              <label
                key={c.id}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-teal/30 px-3 py-1.5 text-sm text-teal-deep has-[:checked]:border-teal-deep has-[:checked]:bg-teal-deep has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal"
              >
                <input type="checkbox" name="critique" value={c.id} className="size-4 shrink-0 accent-white" />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-note`} className="text-sm font-semibold text-ink">
            Anything else? <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <textarea
            id={`${uid}-note`}
            name="note"
            rows={2}
            maxLength={CRITIQUE_LIMITS.note}
            placeholder="e.g. the lime got lost, too much falernum"
            className={`${fieldClass} border-teal`}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-full bg-teal-deep px-4 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-70"
        >
          {pending ? "Thinking…" : "Suggest tweaks"}
        </button>
        {trialId && base === "current" && (
          <p className="text-xs text-ink-soft">Saving new tweaks replaces the trial we&apos;re trying now.</p>
        )}
      </form>

      <div aria-live="polite">
        {state.message && (
          <p
            ref={messageRef}
            tabIndex={-1}
            role={state.status === "error" ? "alert" : undefined}
            className={`rounded-xl border p-3 text-sm outline-none ${state.status === "error" ? "border-coral/30 text-coral-deep" : "border-teal/30 text-teal-deep"}`}
          >
            {state.message}
          </p>
        )}
      </div>
      {p && (
        <div className="flex flex-col gap-3 rounded-xl border border-teal/30 bg-sand-deep/40 p-3">
          <h3 ref={headingRef} tabIndex={-1} className="text-sm font-bold text-teal-deep outline-none">
            Suggested tweaks
          </h3>
          {p.assessment && <p className="text-sm text-ink">{p.assessment}</p>}
          {changes.length > 0 && (
            <ul aria-label="What changes" className="flex flex-col gap-1 text-sm">
              {changes.map((d, i) => (
                <li key={`${i}-${d.ingredient}`} className="flex flex-wrap gap-x-2">
                  <span className="font-semibold text-ink">{d.ingredient}:</span>
                  <span className="text-ink-soft">
                    <span className="sr-only">{KIND_LABEL[d.kind]}. </span>
                    {d.kind === "changed" && (
                      <>
                        <del>{d.from}</del> <span aria-hidden="true">→</span>
                        <span className="sr-only"> to </span> <strong className="text-teal-deep">{d.to}</strong>
                      </>
                    )}
                    {d.kind === "added" && <strong className="text-teal-deep">add {d.to}</strong>}
                    {d.kind === "removed" && <del>{d.from} (leave it out)</del>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {p.methodChange && (
            <p className="text-sm text-ink">
              <span className="font-semibold">Method:</span> {p.methodChange}
            </p>
          )}
          {p.reasons.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-teal underline-offset-2 hover:underline">Why</summary>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm text-ink-soft">
                {p.reasons.map((r, i) => (
                  <li key={i}>
                    {r.ingredient && <span className="font-semibold text-ink">{r.ingredient}: </span>}
                    {r.why}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {p.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-coral-deep">
              {p.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <form key={state.submission} action={saveTrial} className="flex flex-col gap-3 border-t border-teal/20 pt-3">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="replaces" value={trialId ?? ""} />
            <input type="hidden" name="critique" value={state.critique} />
            <input type="hidden" name="reasoning" value={proposalReasoning(p)} />
            <input type="hidden" name="lines" value={p.ingredients.length} />
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-ink">The recipe to try (change anything first)</legend>
              {p.ingredients.map((l, i) => (
                <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[4.5rem_4.5rem_1fr]">
                  <input type="hidden" name={`line-${i}-catalog`} value={l.catalogId} />
                  <input type="hidden" name={`line-${i}-was`} value={l.ingredient} />
                  <label className="sr-only" htmlFor={`${uid}-a${i}`}>
                    Amount for line {i + 1}
                  </label>
                  <input
                    id={`${uid}-a${i}`}
                    name={`line-${i}-amount`}
                    defaultValue={l.amount}
                    maxLength={LIMITS.amount}
                    className={`${fieldClass} border-teal px-2`}
                  />
                  <label className="sr-only" htmlFor={`${uid}-u${i}`}>
                    Unit for line {i + 1}
                  </label>
                  <input
                    id={`${uid}-u${i}`}
                    name={`line-${i}-unit`}
                    defaultValue={l.unit}
                    maxLength={LIMITS.unit}
                    className={`${fieldClass} border-teal px-2`}
                  />
                  <div className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-1">
                    <label className="sr-only" htmlFor={`${uid}-i${i}`}>
                      Ingredient for line {i + 1}
                    </label>
                    <input
                      id={`${uid}-i${i}`}
                      name={`line-${i}-ingredient`}
                      defaultValue={l.ingredient}
                      maxLength={LIMITS.ingredient}
                      className={`${fieldClass} border-teal px-2`}
                    />
                    <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                      <input type="checkbox" name={`line-${i}-remove`} className="size-4 accent-coral-deep" />
                      Leave out<span className="sr-only"> {l.ingredient}</span>
                    </label>
                  </div>
                </div>
              ))}
            </fieldset>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${uid}-method`} className="text-sm font-semibold text-ink">
                Method
              </label>
              <textarea
                id={`${uid}-method`}
                name="method"
                rows={3}
                defaultValue={proposedMethod(method, p.methodChange)}
                className={`${fieldClass} border-teal`}
              />
            </div>
            <p className="text-xs text-ink-soft">A trial doesn&apos;t change the recipe: after tasting it, keep it as our version or drop it.</p>
            <SubmitButton pendingText="Saving…" className="w-fit rounded-full bg-coral-deep px-4 py-2.5 text-sm font-bold text-white shadow-sm">
              Save as a trial
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
