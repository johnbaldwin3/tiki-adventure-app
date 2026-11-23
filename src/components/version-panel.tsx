import Link from "next/link";
import { dropTrial, keepTrial, revertToOriginal } from "@/app/cocktails/critique-actions";
import type { Ingredient } from "@/lib/cocktails";
import { diffLines } from "@/lib/critique";
import type { CocktailVersion } from "@/lib/versions";
import { CritiquePanel } from "./critique-panel";
import { FocusMessage } from "./focus-message";
import { MadeForm } from "./made-this";
import { SubmitButton } from "./submit-button";

const STATUS: Record<string, { role: "status" | "alert"; text: string }> = {
  saved: { role: "status", text: "Saved as a trial. Make it, taste it, then keep it or drop it." },
  kept: { role: "status", text: "Kept — this is now our version of the drink. The original is still one tap away." },
  dropped: { role: "status", text: "Dropped the trial. The recipe is as it was." },
  reverted: { role: "status", text: "Back to the original recipe." },
  stale: { role: "status", text: "That had already changed (maybe on the other phone) — here's what's current." },
  empty: { role: "alert", text: "The trial needs at least one ingredient." },
  error: { role: "alert", text: "Couldn't save that. Please try again." },
};

const fmt = (l: { amount: string; unit: string }) => [l.amount, l.unit].filter(Boolean).join(" ");

function DecideForm({
  action,
  slug,
  versionId,
  label,
  pending,
  primary,
}: {
  action: (f: FormData) => Promise<void>;
  slug: string;
  versionId: string;
  label: string;
  pending: string;
  primary?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="versionId" value={versionId} />
      <SubmitButton
        pendingText={pending}
        className={
          primary
            ? "rounded-full bg-teal-deep px-4 py-2.5 text-sm font-bold text-white shadow-sm"
            : "rounded-full border border-teal/30 bg-card px-4 py-2.5 text-sm font-semibold text-teal-deep"
        }
      >
        {label}
      </SubmitButton>
    </form>
  );
}

/**
 * Our tweaks to a drink, above its ingredients: the trial we're trying
 * (with Keep it / Drop it), and which recipe is showing -- our version
 * (the default once we've kept one) or the verified original.
 */
export function VersionPanel({
  slug,
  name,
  current,
  currentMethod,
  trial,
  active,
  showingOriginal,
  canEdit,
  status,
}: {
  slug: string;
  name: string;
  /** The recipe a trial is compared against (our version, else the original). */
  current: Ingredient[];
  currentMethod: string | null;
  trial?: CocktailVersion;
  active?: CocktailVersion;
  showingOriginal: boolean;
  canEdit: boolean;
  status?: string | string[];
}) {
  const msg = typeof status === "string" ? STATUS[status] : undefined;
  if (!msg && !trial && !active) return null;
  const diff = trial ? diffLines(current, trial.ingredients) : [];
  const changed = new Set(diff.filter((d) => d.kind === "changed" || d.kind === "added").map((d) => d.ingredient));
  const removed = diff.filter((d) => d.kind === "removed");
  const trialMethod = trial ? (trial.methodSummary ?? currentMethod) : null;

  return (
    <section id="our-version" aria-label="Our tweaks" className="flex scroll-mt-4 flex-col gap-3">
      {msg && (
        <FocusMessage
          role={msg.role}
          className={`rounded-2xl border bg-card p-3 text-sm shadow-sm ${msg.role === "alert" ? "border-coral/30 text-coral-deep" : "border-teal/30 text-teal-deep"}`}
        >
          {msg.text}
        </FocusMessage>
      )}

      {active && (
        <div className="flex flex-col gap-2 rounded-2xl border border-teal/30 bg-sand-deep p-3 text-sm text-teal-deep shadow-sm">
          {showingOriginal ? (
            <p>
              Showing the <strong>original</strong> recipe.{" "}
              <Link href={`/cocktails/${slug}`} className="font-semibold underline underline-offset-2">
                Back to our version
              </Link>
            </p>
          ) : (
            <>
              <p>
                <strong>Our version</strong> — tweaked from the original{active.critique ? ` after we said: ${active.critique}` : ""}.{" "}
                <Link href={`/cocktails/${slug}?version=original`} className="font-semibold underline underline-offset-2">
                  See the original
                </Link>
              </p>
              {active.reasoning && (
                <details>
                  <summary className="cursor-pointer font-semibold underline-offset-2 hover:underline">What we changed and why</summary>
                  <p className="mt-1 whitespace-pre-line text-ink">{active.reasoning}</p>
                </details>
              )}
              {canEdit && (
                <details>
                  <summary className="cursor-pointer font-semibold underline-offset-2 hover:underline">Go back to the original</summary>
                  <p className="mt-1 text-ink">Our version is set aside and the card shows the original recipe again.</p>
                  <div className="mt-2">
                    <DecideForm action={revertToOriginal} slug={slug} versionId={active.id} label="Use the original again" pending="Switching…" />
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      )}

      {trial && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-coral/40 bg-card p-4 shadow-sm">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-coral-deep">Trying a tweak</h2>
            {trial.critique && <p className="mt-1 text-sm text-ink-soft">We said: {trial.critique}</p>}
          </div>
          <ul aria-label={`Trial recipe for ${name}`} className="flex flex-col divide-y divide-teal/10">
            {trial.ingredients.map((l, i) => (
              <li key={`${i}-${l.ingredient}`} className="flex gap-3 py-1.5 text-sm">
                <span className={`min-w-20 shrink-0 font-bold ${changed.has(l.ingredient) ? "text-coral-deep" : "text-teal-deep"}`}>{fmt(l)}</span>
                <span className="text-ink">
                  {l.ingredient}
                  {changed.has(l.ingredient) && <span className="ml-1 text-xs font-semibold text-coral-deep">(changed)</span>}
                </span>
              </li>
            ))}
          </ul>
          {removed.length > 0 && <p className="text-xs text-ink-soft">Left out: {removed.map((d) => d.ingredient).join(", ")}</p>}
          {trialMethod && (
            <p className="text-sm text-ink">
              <span className="font-semibold">Method:</span> {trialMethod}
            </p>
          )}
          {trial.reasoning && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-teal underline-offset-2 hover:underline">Why these changes</summary>
              <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{trial.reasoning}</p>
            </details>
          )}
          {canEdit && (
            <>
              <MadeForm slug={slug} servings={1} recipe="trial" label="We made the trial (1 drink)" />
              <div className="flex flex-wrap gap-2">
                <DecideForm action={keepTrial} slug={slug} versionId={trial.id} label="Keep it" pending="Keeping…" primary />
                <DecideForm action={dropTrial} slug={slug} versionId={trial.id} label="Drop it" pending="Dropping…" />
              </div>
              <p className="text-xs text-ink-soft">Keep it to make this our version of the drink (the original stays one tap away).</p>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-teal underline-offset-2 hover:underline">
                  Still not right? Tweak the trial
                </summary>
                <div className="mt-2">
                  <CritiquePanel key={trial.id} slug={slug} name={name} method={trialMethod} base="trial" trialId={trial.id} />
                </div>
              </details>
            </>
          )}
        </div>
      )}
    </section>
  );
}
