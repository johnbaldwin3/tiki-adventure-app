"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { fieldClass } from "@/components/form-field";
import { resizePhoto } from "@/lib/client/resize-photo";
import { emptyDraft } from "@/lib/recipe-form";
import type { ImportKind } from "@/lib/recipe-import";
import { RecipeForm, type CatalogGroup } from "../recipe-form";
import { extractRecipe, type ImportState } from "../recipe-actions";

const KINDS: { value: ImportKind; label: string }[] = [
  { value: "photo", label: "Photo" },
  { value: "link", label: "Link" },
  { value: "text", label: "Paste text" },
];

/**
 * Step 1: give the recipe helper a photo, a link or some text; it drafts
 * the recipe. Step 2: review/fix everything in the form, then save.
 * Nothing is saved until "Save recipe".
 */
export function ImportRecipe({ catalog }: { catalog: CatalogGroup[] }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    extractRecipe,
    {
      submission: 0,
      status: "idle",
      message: null,
      draft: null,
      warnings: [],
      kind: "photo",
    },
  );
  const [kind, setKind] = useState<ImportKind>(state.kind);
  const [photo, setPhoto] = useState<string>("");
  const [photoError, setPhotoError] = useState<string>("");
  const [manual, setManual] = useState(false);
  const photoToken = useRef(0);

  const messageRef = useRef<HTMLParagraphElement>(null);
  const reviewRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state.submission === 0) return;
    if (state.status === "draft") reviewRef.current?.focus();
    else messageRef.current?.focus();
  }, [state.submission, state.status]);

  const draft =
    state.status === "draft" ? state.draft : manual ? emptyDraft() : null;

  if (draft) {
    return (
      <section aria-labelledby="review-heading" className="flex flex-col gap-3">
        <h2
          id="review-heading"
          ref={reviewRef}
          tabIndex={-1}
          className="text-lg font-bold text-teal-deep"
        >
          {state.status === "draft"
            ? "Check the recipe, then save"
            : "New recipe"}
        </h2>
        {state.status === "draft" && (
          <p className="text-sm text-ink-soft">
            The recipe helper can misread things. Compare it with the original —
            amounts especially — before saving.
          </p>
        )}
        <RecipeForm
          key={state.submission}
          initial={draft}
          catalog={catalog}
          warnings={state.status === "draft" ? state.warnings : []}
          cancelHref="/"
        />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        // Submitted by hand (not via action=) so React doesn't reset the form
        // afterwards: if the helper finds nothing, the text/link stays put to fix.
        onSubmit={(ev) => {
          ev.preventDefault();
          const data = new FormData(ev.currentTarget);
          startTransition(() => formAction(data));
        }}
        className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-sm"
      >
        <input type="hidden" name="kind" value={kind} />
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Add from</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <label
                key={k.value}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-teal/30 px-3 py-2 text-sm font-semibold text-teal-deep has-checked:bg-teal-deep has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-teal"
              >
                <input
                  type="radio"
                  name="kind-choice"
                  value={k.value}
                  checked={kind === k.value}
                  onChange={() => setKind(k.value)}
                  className="sr-only"
                />
                {k.label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* All three stay mounted (just hidden), so switching doesn't lose what was typed. */}
        <div hidden={kind !== "photo"}>
          <label htmlFor="photo" className="text-sm font-semibold text-ink">
            Photo of the recipe{" "}
            <span className="font-normal text-ink-soft">
              (book page, card or screenshot)
            </span>
          </label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            aria-describedby={photoError ? "photo-error" : undefined}
            onChange={async (ev) => {
              const file = ev.target.files?.[0];
              const token = ++photoToken.current; // a later choice wins
              setPhoto("");
              setPhotoError("");
              if (!file) return;
              try {
                const resized = await resizePhoto(file);
                if (token === photoToken.current) setPhoto(resized);
              } catch {
                if (token === photoToken.current) {
                  setPhotoError(
                    "Couldn't read that photo. Try a JPEG or PNG (or a screenshot of it).",
                  );
                }
              }
            }}
            className="mt-1 block w-full text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-teal-deep file:px-4 file:py-2 file:font-semibold file:text-white"
          />
          <input type="hidden" name="image" value={photo} />
          {photoError && (
            <p
              id="photo-error"
              className="mt-1 text-sm font-semibold text-coral-deep"
            >
              {photoError}
            </p>
          )}
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- a local data: URL preview
            <img
              src={photo}
              alt="The photo you chose"
              className="mt-2 max-h-48 w-auto rounded-xl border border-teal/20"
            />
          )}
        </div>

        <div hidden={kind !== "link"}>
          <label htmlFor="url" className="text-sm font-semibold text-ink">
            Link to the recipe
          </label>
          <input
            id="url"
            name="url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            className={`mt-1 ${fieldClass} border-teal`}
          />
        </div>

        <div hidden={kind !== "text"}>
          <label htmlFor="text" className="text-sm font-semibold text-ink">
            Recipe text
          </label>
          <textarea
            id="text"
            name="text"
            rows={8}
            maxLength={20000}
            placeholder={
              "e.g.\n2 oz aged rum\n3/4 oz lime juice\n1/2 oz orgeat…"
            }
            className={`mt-1 ${fieldClass} border-teal`}
          />
        </div>

        <button
          type="submit"
          disabled={pending || (kind === "photo" && !photo)}
          aria-describedby={
            kind === "photo" && !photo ? "photo-needed" : undefined
          }
          className="rounded-full bg-teal-deep px-4 py-3 text-base font-bold text-white shadow-sm disabled:opacity-70"
        >
          {pending ? "Reading the recipe…" : "Read the recipe"}
        </button>
        {kind === "photo" && !photo && (
          <p id="photo-needed" className="-mt-2 text-xs text-ink-faint">
            Choose a photo first.
          </p>
        )}
        <p aria-live="polite" className="sr-only">
          {pending
            ? "Reading the recipe. This can take up to half a minute."
            : ""}
        </p>
      </form>

      {!pending && (state.status === "error" || state.status === "none") && (
        <p
          ref={messageRef}
          tabIndex={-1}
          role="alert"
          className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm"
        >
          {state.message}
        </p>
      )}

      <button
        type="button"
        onClick={() => setManual(true)}
        className="w-fit px-1 text-sm font-semibold text-teal underline underline-offset-2"
      >
        Or type it in yourself
      </button>

      <p className="text-xs text-ink-faint">
        The recipe helper uses an AI model (via OpenRouter) to read the photo,
        page or text. It&apos;s only sent what you give it here.
      </p>
    </div>
  );
}
