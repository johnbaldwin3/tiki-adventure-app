"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { fieldClass } from "@/components/form-field";
import { resizePhoto } from "@/lib/client/resize-photo";
import { emptyDraft } from "@/lib/recipe-form";
import type { GuessInfo, ImportKind } from "@/lib/recipe-import";
import { RecipeForm, type CatalogGroup } from "../recipe-form";
import { extractRecipe, type ImportState } from "../recipe-actions";

const KINDS: { value: ImportKind; label: string }[] = [
  { value: "photo", label: "Photo" },
  { value: "link", label: "Link" },
  { value: "text", label: "Paste text" },
  { value: "menu", label: "From a menu" },
];

/** A photo input that shrinks the photo in the browser and puts it in a hidden field. */
function PhotoField({
  id,
  name,
  label,
  hint,
  onChange,
  value,
  active,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  value: string;
  onChange: (dataUrl: string) => void;
  /** Only the current mode's photo is sent (keeps the upload small). */
  active: boolean;
}) {
  const [error, setError] = useState("");
  const token = useRef(0);
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label} <span className="font-normal text-ink-soft">{hint}</span>
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={async (ev) => {
          const file = ev.target.files?.[0];
          const mine = ++token.current; // a later choice wins
          onChange("");
          setError("");
          if (!file) return;
          try {
            const resized = await resizePhoto(file);
            if (mine === token.current) onChange(resized);
          } catch {
            if (mine === token.current) {
              setError("Couldn't read that photo. Try a JPEG or PNG (or a screenshot of it).");
            }
          }
        }}
        className="mt-1 block w-full text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-teal-deep file:px-4 file:py-2 file:font-semibold file:text-white"
      />
      <input type="hidden" name={name} value={value} disabled={!active} />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-coral-deep">
          {error}
        </p>
      )}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element -- a local data: URL preview
        <img src={value} alt="The photo you chose" className="mt-2 max-h-48 w-auto rounded-xl border border-teal/20" />
      )}
    </div>
  );
}

/** How a best guess was worked out: reasoning, our recipes it leaned on, web pages it read. */
function GuessPanel({ guess }: { guess: GuessInfo }) {
  return (
    <section aria-labelledby="guess-heading" className="rounded-2xl border border-teal/20 bg-card p-4 text-sm text-ink-soft shadow-sm">
      <h3 id="guess-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
        How the helper worked it out
      </h3>
      {guess.reasoning && <p className="mt-2 text-ink">{guess.reasoning}</p>}
      {guess.basedOn.length > 0 && (
        <p className="mt-2">
          Based on our:{" "}
          {guess.basedOn.map((r, i) => (
            <span key={r.slug}>
              {i > 0 && ", "}
              <Link
                href={`/cocktails/${r.slug}`}
                prefetch={false}
                target="_blank"
                className="font-semibold text-teal underline underline-offset-2"
              >
                {r.name}
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
            </span>
          ))}
        </p>
      )}
      {guess.sources.length > 0 && (
        <div className="mt-2">
          <p>
            Web pages it read{" "}
            <span className="text-ink-faint">
              (if one has this exact recipe, paste it into Link below)
            </span>
            :
          </p>
          <ul className="mt-1 list-disc pl-5">
            {guess.sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="font-semibold text-teal underline underline-offset-2"
                >
                  {s.title}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

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
  const [menuPhoto, setMenuPhoto] = useState<string>("");
  // Controlled, so they survive React's form reset after a failed attempt.
  const [menuText, setMenuText] = useState<string>("");
  const [menuName, setMenuName] = useState<string>("");
  const [place, setPlace] = useState<string>("");
  const [web, setWeb] = useState(true);
  const [manual, setManual] = useState(false);

  const messageRef = useRef<HTMLParagraphElement>(null);
  const reviewRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state.submission === 0) return;
    if (state.status === "draft") reviewRef.current?.focus();
    else messageRef.current?.focus();
  }, [state.submission, state.status]);

  const draft =
    state.status === "draft" ? state.draft : manual ? emptyDraft() : null;
  const needs =
    kind === "photo" && !photo
      ? "Choose a photo first."
      : kind === "menu" && !menuText.trim() && !menuPhoto
        ? "Type what the menu says, or add a photo of it."
        : null;

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
        {state.status === "draft" &&
          (state.guess ? (
            <p className="text-sm text-ink-soft">
              The menu didn&apos;t give amounts, so these are the recipe
              helper&apos;s best guess. Check they look sensible, save it as a
              best guess, then adjust after tasting.
            </p>
          ) : (
            <p className="text-sm text-ink-soft">
              The recipe helper can misread things. Compare it with the original —
              amounts especially — before saving.
            </p>
          ))}
        {state.status === "draft" && state.guess && <GuessPanel guess={state.guess} />}
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
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
          <PhotoField
            id="photo"
            name="image"
            label="Photo of the recipe"
            hint="(book page, card or screenshot)"
            value={photo}
            onChange={setPhoto}
            active={kind === "photo"}
          />
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

        <div hidden={kind !== "menu"} className="flex flex-col gap-3">
          <p className="text-sm text-ink-soft">
            Menus list what&apos;s in a drink but not how much. The recipe
            helper works out amounts from the ratios in our recipes (and, if you
            like, a quick web search), and you save it as a best guess.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="menuName" className="text-sm font-semibold text-ink">
                Drink name <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <input
                id="menuName"
                name="menuName"
                value={menuName}
                onChange={(ev) => setMenuName(ev.target.value)}
                maxLength={80}
                autoComplete="off"
                className={`mt-1 ${fieldClass} border-teal`}
              />
            </div>
            <div>
              <label htmlFor="place" className="text-sm font-semibold text-ink">
                Bar or restaurant <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <input
                id="place"
                name="place"
                value={place}
                onChange={(ev) => setPlace(ev.target.value)}
                maxLength={120}
                autoComplete="off"
                placeholder="e.g. Three Dots and a Dash, Chicago"
                className={`mt-1 ${fieldClass} border-teal`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="menu" className="text-sm font-semibold text-ink">
              What the menu says
            </label>
            <textarea
              id="menu"
              name="menu"
              rows={4}
              maxLength={2000}
              value={menuText}
              onChange={(ev) => setMenuText(ev.target.value)}
              placeholder="e.g. aged Jamaican rum, passion fruit, lime, honey, a float of overproof"
              className={`mt-1 ${fieldClass} border-teal`}
            />
          </div>
          <PhotoField
            id="menuPhoto"
            name="menuImage"
            label="Or a photo of the menu"
            hint="(optional)"
            value={menuPhoto}
            onChange={setMenuPhoto}
            active={kind === "menu"}
          />
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="web"
              checked={web}
              onChange={(ev) => setWeb(ev.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-teal-deep"
            />
            <span>
              Also search the web for this drink{" "}
              <span className="text-ink-soft">(a few cents; can take up to a minute)</span>
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={pending || needs !== null}
          aria-describedby={needs ? "input-needed" : undefined}
          className="rounded-full bg-teal-deep px-4 py-3 text-base font-bold text-white shadow-sm disabled:opacity-70"
        >
          {kind === "menu"
            ? pending
              ? "Working it out…"
              : "Work out a recipe"
            : pending
              ? "Reading the recipe…"
              : "Read the recipe"}
        </button>
        {needs && (
          <p id="input-needed" className="-mt-2 text-xs text-ink-faint">
            {needs}
          </p>
        )}
        <p aria-live="polite" className="sr-only">
          {pending
            ? kind === "menu"
              ? "Working out a recipe. This can take up to a minute."
              : "Reading the recipe. This can take up to half a minute."
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
        page or text. It&apos;s only sent what you give it here (plus, for a
        menu, our recipe list to learn ratios from).
      </p>
    </div>
  );
}
