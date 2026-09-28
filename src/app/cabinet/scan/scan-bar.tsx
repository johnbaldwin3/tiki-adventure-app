"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { resizePhoto } from "@/lib/client/resize-photo";
import { SIZE_CHOICES } from "@/lib/inventory";
import type { BottleDraft, ReceiptDraft } from "@/lib/scan";
import { saveReceipt, saveScannedBottle, scanPhoto, type SaveScanState, type ScanKind, type ScanState } from "./actions";

export interface CatalogGroup {
  family: string;
  items: { id: string; name: string }[];
}

/** What's in our bar now, per style: shown so a save that replaces it is no surprise. */
export type CurrentBar = Record<string, { bottle: string | null; left: string | null }>;

function Replaces({ current, id }: { current: CurrentBar; id: string }) {
  const now = id ? current[id] : undefined;
  if (!now) return null;
  return (
    <p className="text-xs text-ink-soft">
      Replaces what&apos;s in our bar for this style{now.bottle ? `: ${now.bottle}` : ""}
      {now.left ? ` (${now.left})` : ""}.
    </p>
  );
}

const field = "mt-1 w-full rounded-xl border border-teal bg-card px-3 py-2 text-base text-ink";
const sizeLabel = (s: number) => (s >= 1000 ? `${s / 1000} L` : `${s} ml`);

/** Submit by hand so React doesn't reset the form (edits stay if saving fails). */
function submitWith(action: (data: FormData) => void) {
  return (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const data = new FormData(ev.currentTarget);
    startTransition(() => action(data));
  };
}

function StyleSelect({
  id,
  name,
  value,
  catalog,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  name: string;
  value: string;
  catalog: CatalogGroup[];
  invalid?: boolean;
  describedBy?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={value}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? describedBy : undefined}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className={field}
    >
      <option value="">Choose…</option>
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
  );
}

function SizeSelect({
  id,
  name,
  value,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  value: number | null;
  invalid?: boolean;
  describedBy?: string;
}) {
  const sizes = [...new Set([...SIZE_CHOICES, ...(value ? [value] : [])])].sort((a, b) => a - b);
  return (
    <select
      id={id}
      name={name}
      defaultValue={value ? String(value) : ""}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? describedBy : undefined}
      className={field}
    >
      <option value="">Choose…</option>
      {sizes.map((s) => (
        <option key={s} value={s}>
          {sizeLabel(s)}
        </option>
      ))}
    </select>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-2xl border border-coral/30 bg-card p-3 text-sm shadow-sm">
      <p className="font-semibold text-coral-deep">Check these:</p>
      <ul className="mt-1 list-disc pl-5 text-ink-soft">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

function SaveMessage({ state }: { state: SaveScanState }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.submission > 0) ref.current?.focus();
  }, [state.submission]);
  if (!state.message) return null;
  return (
    <p ref={ref} tabIndex={-1} role="alert" className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm">
      {state.message}
    </p>
  );
}

function BottleReview({ draft, catalog, current }: { draft: BottleDraft; catalog: CatalogGroup[]; current: CurrentBar }) {
  const [state, action, pending] = useActionState<SaveScanState, FormData>(saveScannedBottle, { submission: 0, message: null, problems: [] });
  const [pct, setPct] = useState(draft.fillPercent);
  const [style, setStyle] = useState(draft.catalogId);
  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-4">
      <SaveMessage state={state} />
      <Warnings warnings={draft.warnings} />
      <div>
        <label htmlFor="product" className="text-sm font-semibold text-ink">
          Bottle
        </label>
        <input id="product" name="product" defaultValue={draft.product} maxLength={120} className={field} />
      </div>
      <div>
        <label htmlFor="catalogId" className="text-sm font-semibold text-ink">
          Style in our catalog
        </label>
        <StyleSelect id="catalogId" name="catalogId" value={draft.catalogId} catalog={catalog} onChange={setStyle} />
        <Replaces current={current} id={style} />
      </div>
      <div>
        <label htmlFor="sizeMl" className="text-sm font-semibold text-ink">
          Bottle size
        </label>
        <SizeSelect id="sizeMl" name="sizeMl" value={draft.sizeMl} />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="fillPercent" className="text-sm font-semibold text-ink">
            How full
          </label>
          <output htmlFor="fillPercent" aria-hidden="true" className="text-sm font-semibold text-teal-deep">
            {pct}%
          </output>
        </div>
        <input
          id="fillPercent"
          name="fillPercent"
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          aria-valuetext={`${pct}% full`}
          aria-describedby="fill-hint"
          className="mt-2 w-full accent-teal-deep"
        />
        <p id="fill-hint" className="text-xs text-ink-faint">
          Estimated from the photo — adjust if it looks off.
        </p>
      </div>
      <button type="submit" disabled={pending} className="rounded-full bg-teal-deep px-4 py-3 text-base font-bold text-white shadow-sm disabled:opacity-70">
        {pending ? "Saving…" : "Save to our bar"}
      </button>
    </form>
  );
}

function ReceiptReview({ draft, catalog, current }: { draft: ReceiptDraft; catalog: CatalogGroup[]; current: CurrentBar }) {
  const [state, action, pending] = useActionState<SaveScanState, FormData>(saveReceipt, { submission: 0, message: null, problems: [] });
  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-4">
      <input type="hidden" name="rows" value={draft.items.length} />
      <SaveMessage state={state} />
      <Warnings warnings={draft.warnings} />
      {draft.store && <p className="text-sm text-ink-soft">From {draft.store}.</p>}
      <p className="text-xs text-ink-faint">
        Tick what goes in our bar. Each is added as a full bottle (replacing that style&apos;s level if we already have it).
      </p>
      <ol className="flex flex-col gap-3">
        {draft.items.map((item, i) => {
          const problem = state.problems.find((p) => p.row === i);
          const errorId = `row-${i}-error`;
          return (
            <li key={i} className="rounded-2xl bg-card p-3 shadow-sm">
              <fieldset>
                <legend className="text-xs text-ink-faint">
                  Receipt line: <span className="font-mono">{item.line || item.product}</span>
                  {item.quantity > 1 && ` (×${item.quantity})`}
                </legend>
                <label className="mt-1 flex items-center gap-2 text-sm font-semibold text-ink">
                  <input type="checkbox" name={`row-${i}-add`} defaultChecked={!!item.catalogId} className="h-5 w-5 accent-teal-deep" />
                  Add to our bar<span className="sr-only">: {item.product || item.line}</span>
                </label>
                <label htmlFor={`row-${i}-product`} className="mt-2 block text-xs text-ink-soft">
                  Bottle
                </label>
                <input id={`row-${i}-product`} name={`row-${i}-product`} defaultValue={item.product} maxLength={120} className={field} />
                <div className="mt-2 grid grid-cols-[1fr_7rem] gap-2">
                  <div>
                    <label htmlFor={`row-${i}-catalogId`} className="text-xs text-ink-soft">
                      Style
                    </label>
                    <StyleSelect
                      id={`row-${i}-catalogId`}
                      name={`row-${i}-catalogId`}
                      value={item.catalogId}
                      catalog={catalog}
                      invalid={problem?.style || problem?.duplicate}
                      describedBy={errorId}
                    />
                  </div>
                  <div>
                    <label htmlFor={`row-${i}-sizeMl`} className="text-xs text-ink-soft">
                      Size
                    </label>
                    <SizeSelect
                      id={`row-${i}-sizeMl`}
                      name={`row-${i}-sizeMl`}
                      value={item.sizeMl}
                      invalid={problem?.size}
                      describedBy={errorId}
                    />
                  </div>
                </div>
                {item.quantity > 1 && (
                  <p className="mt-1 text-xs text-ink-soft">
                    Bought {item.quantity}: we track one bottle per style, so the others aren&apos;t counted.
                  </p>
                )}
                <Replaces current={current} id={item.catalogId} />
                {problem && (
                  <p id={errorId} className="mt-1 text-sm font-semibold text-coral-deep">
                    {problem.duplicate
                      ? "Another ticked item has this style — untick one (we track one bottle per style)."
                      : `Pick ${problem.style && problem.size ? "a style and size" : problem.style ? "a style" : "a size"}, or untick it.`}
                  </p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>
      <button type="submit" disabled={pending} className="rounded-full bg-teal-deep px-4 py-3 text-base font-bold text-white shadow-sm disabled:opacity-70">
        {pending ? "Saving…" : "Add ticked items to our bar"}
      </button>
    </form>
  );
}

const KINDS: { value: ScanKind; label: string; hint: string }[] = [
  { value: "bottle", label: "A bottle", hint: "Snap the label (and the liquid line) of one bottle." },
  { value: "receipt", label: "A receipt", hint: "From the grocery store, WineXpress or a liquor store." },
];

/**
 * The bar scanner: a photo of a bottle (what it is, size, how full) or a
 * receipt (the bottles bought). The model's answer fills a form to check;
 * nothing is saved until "Save".
 */
export function ScanBar({ catalog, current }: { catalog: CatalogGroup[]; current: CurrentBar }) {
  // "Scan another photo" starts over by remounting the scanner.
  const [round, setRound] = useState(0);
  return <Scanner key={round} catalog={catalog} current={current} onRestart={() => setRound((r) => r + 1)} />;
}

function Scanner({ catalog, current, onRestart }: { catalog: CatalogGroup[]; current: CurrentBar; onRestart: () => void }) {
  const [state, action, pending] = useActionState<ScanState, FormData>(scanPhoto, {
    submission: 0,
    kind: "bottle",
    status: "idle",
    message: null,
    bottle: null,
    receipt: null,
  });
  const [kind, setKind] = useState<ScanKind>("bottle");
  const [file, setFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [answeredFor, setAnsweredFor] = useState<string | null>(null);
  const token = useRef(0);
  // Resize when the photo or the kind changes (receipts keep more detail).
  useEffect(() => {
    if (!file) return;
    const mine = ++token.current;
    resizePhoto(file, kind === "receipt" ? 3000 : 1600)
      .then((resized) => {
        if (mine === token.current) setPhoto(resized);
      })
      .catch(() => {
        if (mine === token.current) setPhotoError("Couldn't read that photo. Try a JPEG or PNG (or a screenshot of it).");
      });
  }, [file, kind]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.submission === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marks which answer the message belongs to
    setAnsweredFor(String(state.submission));
    if (state.status === "bottle" || state.status === "receipt") headingRef.current?.focus();
  }, [state.submission, state.status]);
  useEffect(() => {
    if (answeredFor) messageRef.current?.focus();
  }, [answeredFor]);

  if (state.status === "bottle" && state.bottle) {
    return (
      <section aria-labelledby="review-heading" className="flex flex-col gap-3">
        <h2 id="review-heading" ref={headingRef} tabIndex={-1} className="text-lg font-bold text-teal-deep">
          Check the bottle, then save
        </h2>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- a local data: URL preview
          <img src={photo} alt="The photo being read" className="max-h-64 w-auto rounded-xl border border-teal/20" />
        )}
        <BottleReview key={state.submission} draft={state.bottle} catalog={catalog} current={current} />
        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={onRestart} className="px-1 text-sm font-semibold text-teal underline underline-offset-2">
            Scan another photo
          </button>
          <Link href="/cabinet" className="px-1 text-sm font-semibold text-teal underline underline-offset-2">
            Cancel
          </Link>
        </div>
      </section>
    );
  }
  if (state.status === "receipt" && state.receipt) {
    return (
      <section aria-labelledby="review-heading" className="flex flex-col gap-3">
        <h2 id="review-heading" ref={headingRef} tabIndex={-1} className="text-lg font-bold text-teal-deep">
          Check the receipt, then add
        </h2>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- a local data: URL preview
          <img src={photo} alt="The photo being read" className="max-h-64 w-auto rounded-xl border border-teal/20" />
        )}
        <ReceiptReview key={state.submission} draft={state.receipt} catalog={catalog} current={current} />
        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={onRestart} className="px-1 text-sm font-semibold text-teal underline underline-offset-2">
            Scan another photo
          </button>
          <Link href="/cabinet" className="px-1 text-sm font-semibold text-teal underline underline-offset-2">
            Cancel
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submitWith(action)} className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-sm">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="image" value={photo} />
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Photo of</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <label
                key={k.value}
                className="flex cursor-pointer items-center justify-center rounded-full border border-teal/30 px-3 py-2 text-sm font-semibold text-teal-deep has-checked:bg-teal-deep has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-teal"
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
          <p className="mt-2 text-xs text-ink-faint">{KINDS.find((k) => k.value === kind)!.hint}</p>
        </fieldset>
        <div>
          <label htmlFor="scan-photo" className="text-sm font-semibold text-ink">
            Photo
          </label>
          <input
            id="scan-photo"
            type="file"
            accept="image/*"
            aria-describedby={photoError ? "scan-photo-error" : undefined}
            onChange={(ev) => {
              token.current++;
              setPhoto("");
              setPhotoError("");
              setAnsweredFor(null); // a new photo clears the last answer's message
              setFile(ev.target.files?.[0] ?? null);
            }}
            className="mt-1 block w-full text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-teal-deep file:px-4 file:py-2 file:font-semibold file:text-white"
          />
          {photoError && (
            <p id="scan-photo-error" className="mt-1 text-sm font-semibold text-coral-deep">
              {photoError}
            </p>
          )}
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- a local data: URL preview
            <img src={photo} alt="The photo you chose" className="mt-2 max-h-48 w-auto rounded-xl border border-teal/20" />
          )}
        </div>
        <button
          type="submit"
          disabled={pending || !photo}
          aria-describedby={!photo ? "scan-photo-needed" : undefined}
          className="rounded-full bg-teal-deep px-4 py-3 text-base font-bold text-white shadow-sm disabled:opacity-70"
        >
          {pending ? "Reading the photo…" : "Read the photo"}
        </button>
        {!photo && (
          <p id="scan-photo-needed" className="-mt-2 text-xs text-ink-faint">
            Choose a photo first.
          </p>
        )}
        <p aria-live="polite" className="sr-only">
          {pending ? "Reading the photo. This can take up to a minute." : ""}
        </p>
      </form>
      {!pending && answeredFor === String(state.submission) && (state.status === "error" || state.status === "none") && (
        <p ref={messageRef} tabIndex={-1} role="alert" className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm">
          {state.message}
        </p>
      )}
      <p className="text-xs text-ink-faint">
        The photo is read by an AI model (via OpenRouter). Nothing is saved until you check it.
      </p>
    </div>
  );
}
