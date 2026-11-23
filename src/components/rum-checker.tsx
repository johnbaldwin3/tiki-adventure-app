"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { checkRum, labelBarRum, type RumCheckState } from "@/app/rums/actions";
import { resizePhoto } from "@/lib/client/resize-photo";
import { RUM_CHECK_LIMITS } from "@/lib/rum-check";
import { fieldClass } from "./form-field";
import { RumBadge } from "./rum-badge";
import { SubmitButton } from "./submit-button";

const INITIAL: RumCheckState = { submission: 0, status: "idle", message: null, answer: null };

export interface BarRumChoice {
  ingredientId: string;
  styleName: string;
  bottle: string | null;
}

/**
 * "What number is this rum?" -- snap the label in the shop (or type the
 * name). Names the book lists answer instantly; anything else goes to the
 * rum checker AI, whose answer is marked as a best guess. Separate from the
 * bar scanner: nothing is saved unless we label one of our bottles.
 */
export function RumChecker({ barRums }: { barRums: BarRumChoice[] }) {
  const [state, action, pending] = useActionState(checkRum, INITIAL);
  const [photo, setPhoto] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const resizing = !!file && !photo && !photoError;
  const token = useRef(0);
  const uid = useId();
  const resultRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!file) return;
    const mine = ++token.current;
    resizePhoto(file, 1600)
      .then((resized) => {
        if (mine === token.current) setPhoto(resized);
      })
      .catch(() => {
        if (mine === token.current) setPhotoError("Couldn't read that photo. Try a JPEG or PNG (or a screenshot of it).");
      });
  }, [file]);
  useEffect(() => {
    if (state.submission === 0) return;
    (state.answer ? resultRef.current : messageRef.current)?.focus();
  }, [state.submission, state.answer]);

  const a = state.answer;
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="image" value={photo} />
        <div>
          <label htmlFor={`${uid}-photo`} className="text-sm font-semibold text-ink">
            Photo of the label <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input
            id={`${uid}-photo`}
            type="file"
            accept="image/*"
            capture="environment"
            aria-describedby={photoError ? `${uid}-photo-error` : undefined}
            onChange={(ev) => {
              token.current++;
              setPhoto("");
              setPhotoError("");
              setFile(ev.target.files?.[0] ?? null);
            }}
            className="mt-1 block w-full text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-teal-deep file:px-4 file:py-2 file:font-semibold file:text-white"
          />
          {photoError && (
            <p id={`${uid}-photo-error`} className="mt-1 text-sm font-semibold text-coral-deep">
              {photoError}
            </p>
          )}
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- a local data: URL preview
            <img src={photo} alt="The label photo you chose" className="mt-2 max-h-40 w-auto rounded-xl border border-teal/20" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-name`} className="text-sm font-semibold text-ink">
            …or the bottle&apos;s name
          </label>
          <input
            id={`${uid}-name`}
            name="name"
            maxLength={RUM_CHECK_LIMITS.name}
            placeholder="e.g. Appleton Estate 8 Year Reserve"
            autoComplete="off"
            className={`${fieldClass} border-teal`}
          />
        </div>
        <button
          type="submit"
          disabled={pending || resizing}
          className="w-fit rounded-full bg-teal-deep px-4 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-70"
        >
          {pending ? "Checking…" : resizing ? "Getting the photo ready…" : "What number is it?"}
        </button>
        <p aria-live="polite" className="sr-only">
          {pending ? "Checking the bottle. This can take up to a minute." : ""}
        </p>
      </form>

      {state.message && (
        <p
          ref={messageRef}
          tabIndex={-1}
          className="rounded-xl border border-coral/30 p-3 text-sm text-coral-deep outline-none"
        >
          {state.message}
        </p>
      )}

      {a && (
        <div
          ref={resultRef}
          tabIndex={-1}
          role="region"
          aria-labelledby={`${uid}-answer`}
          className="flex flex-col gap-3 rounded-xl border border-teal/30 bg-sand-deep/40 p-3 outline-none"
        >
          <h3 id={`${uid}-answer`} className="text-base font-bold text-ink">
            {a.product}
          </h3>
          {a.category ? (
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-xl font-extrabold text-white"
              >
                {a.category.number ?? "–"}
              </span>
              <p className="text-sm text-ink">
                <span className="block font-bold">
                  {a.category.number ? `Number ${a.category.number}: ` : "No number: "}
                  {a.category.name}
                </span>
                {!a.category.number && (
                  <span className="block text-xs text-ink-soft">The book&apos;s recipes don&apos;t call for this category by number.</span>
                )}
              </p>
            </div>
          ) : (
            <p className="text-sm font-semibold text-ink">
              Not one of the book&apos;s categories (spiced or flavored rums and liqueurs aren&apos;t classified), or it couldn&apos;t tell.
            </p>
          )}
          <p className={`text-sm ${a.basis === "book" ? "text-teal-deep" : "text-coral-deep"}`}>
            {a.basis === "book" ? (
              <>
                <span aria-hidden="true">✓ </span>In the book&apos;s rum list
                {a.listed && a.category ? ` (p. ${a.category.page}): ${a.listed.label}` : ""}.
              </>
            ) : (
              <>
                Not in the book&apos;s list: this is the rum checker&apos;s best guess using the book&apos;s rules ({a.confidence}{" "}
                confidence). Check it against the label.
              </>
            )}
          </p>
          {(a.rawMaterial !== "unknown" || a.still !== "unknown" || a.age || a.abv || a.origin) && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-ink-soft">
              {a.origin && (
                <>
                  <dt className="font-semibold text-ink">From</dt>
                  <dd>{a.origin}</dd>
                </>
              )}
              {a.rawMaterial !== "unknown" && (
                <>
                  <dt className="font-semibold text-ink">Made from</dt>
                  <dd>{a.rawMaterial}</dd>
                </>
              )}
              {a.still !== "unknown" && (
                <>
                  <dt className="font-semibold text-ink">Still</dt>
                  <dd>{a.still}</dd>
                </>
              )}
              {a.age && (
                <>
                  <dt className="font-semibold text-ink">Age</dt>
                  <dd>{a.age}</dd>
                </>
              )}
              {a.abv && (
                <>
                  <dt className="font-semibold text-ink">Strength</dt>
                  <dd>{a.abv}%</dd>
                </>
              )}
            </dl>
          )}
          {a.reasoning && <p className="text-sm text-ink">{a.reasoning}</p>}
          {a.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-coral-deep">
              {a.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          {a.category && <RumBadge category={a.category} />}

          {a.category && barRums.length > 0 && (
            <form key={state.submission} action={labelBarRum} className="flex flex-col gap-2 border-t border-teal/20 pt-3">
              <input type="hidden" name="category" value={a.category.id} />
              <input type="hidden" name="bottle" value={a.product} />
              <input type="hidden" name="basis" value={a.basis} />
              <label htmlFor={`${uid}-ours`} className="text-sm font-semibold text-ink">
                Bought it? Label our bottle
              </label>
              <select id={`${uid}-ours`} name="ingredient" required defaultValue="" className={`${fieldClass} border-teal`}>
                <option value="" disabled>
                  Choose the rum in our bar…
                </option>
                {barRums.map((r) => (
                  <option key={r.ingredientId} value={r.ingredientId}>
                    {r.styleName}
                    {r.bottle ? ` — ${r.bottle}` : ""}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="nameBottle" defaultChecked className="size-5 accent-teal-deep" />
                Also name the bottle &ldquo;{a.product}&rdquo;
              </label>
              <SubmitButton pendingText="Saving…" className="w-fit rounded-full bg-coral-deep px-4 py-2.5 text-sm font-bold text-white shadow-sm">
                Save the number
              </SubmitButton>
              <p className="text-xs text-ink-soft">Not in our bar yet? Add it in Our bar first, then label it here.</p>
            </form>
          )}
        </div>
      )}
      <p className="text-xs text-ink-faint">
        Bottles in the book&apos;s list are answered from the book. Others are read by an AI model (via OpenRouter); nothing is saved
        unless you label one of our bottles.
      </p>
    </div>
  );
}
