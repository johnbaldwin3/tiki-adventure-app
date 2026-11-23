import { cleanCatalogId, LIMITS, type RecipeLine } from "./recipe-form";

/**
 * "Critique a recipe": the tasters say what was off (too sweet, too strong,
 * ...), the recipe helper proposes small, explained changes, they try them
 * as a trial, and keep the ones that work as "our version" of the drink.
 * The verified original is never changed. Pure parts here; the model call
 * is in src/lib/server/critique-ai.ts (prompt: critique-prompt.ts), storage
 * in migration 0014. No catalog import here: the critique panel uses this file.
 */

export const CRITIQUES = [
  { id: "too-sweet", label: "Too sweet" },
  { id: "not-sweet-enough", label: "Not sweet enough" },
  { id: "too-sour", label: "Too sour / tart" },
  { id: "too-strong", label: "Too strong / boozy" },
  { id: "too-weak", label: "Too weak / watery" },
  { id: "too-bitter", label: "Too bitter" },
  { id: "flat", label: "Flat / one-note" },
] as const;

export type CritiqueId = (typeof CRITIQUES)[number]["id"];
const CRITIQUE_IDS = new Set<string>(CRITIQUES.map((c) => c.id));

export const CRITIQUE_LIMITS = { note: 500, assessment: 600, reason: 300, reasons: 12, warning: 300 } as const;

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? Array.from(v.replace(/\s+/g, " ").trim()).slice(0, max).join("").trim() : "";

type FormLike = { get(name: string): unknown; getAll(name: string): unknown[] };

export interface CritiqueInput {
  picks: CritiqueId[];
  note: string;
}

/** The chips ticked and the note typed; null if neither (nothing to go on). */
export function readCritiqueForm(form: FormLike): CritiqueInput | null {
  const picks = [...new Set(form.getAll("critique").filter((v): v is CritiqueId => typeof v === "string" && CRITIQUE_IDS.has(v)))];
  const note = clean(form.get("note"), CRITIQUE_LIMITS.note);
  if (picks.length === 0 && !note) return null;
  return { picks, note };
}

/** "Too sweet, Too strong / boozy — the lime got lost" (stored with a trial so we remember why). */
export function describeCritique(c: CritiqueInput): string {
  const labels = c.picks.map((id) => CRITIQUES.find((x) => x.id === id)!.label);
  return [labels.join(", "), c.note].filter(Boolean).join(" — ").slice(0, TRIAL_LIMITS.critique);
}

export interface Proposal {
  assessment: string;
  ingredients: RecipeLine[];
  reasons: { ingredient: string; why: string }[];
  methodChange: string;
  warnings: string[];
}

/** The model's answer (untrusted) -> a proposal, or null if it's unusable or changes nothing. */
export function proposalFromModel(raw: unknown, current: RecipeLine[]): Proposal | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : [])
    .filter((l): l is Record<string, unknown> => typeof l === "object" && l !== null)
    .map((l) => ({
      amount: clean(l.amount, LIMITS.amount),
      unit: clean(l.unit, LIMITS.unit),
      ingredient: clean(l.ingredient, LIMITS.ingredient),
      catalogId: cleanCatalogId(l.catalogId),
    }))
    .filter((l) => l.ingredient)
    .slice(0, LIMITS.ingredients);
  if (ingredients.length === 0) return null;
  // Unchanged ingredients keep the catalog link they had.
  for (const l of ingredients) {
    const was = current.find((c) => same(c.ingredient, l.ingredient));
    if (was && !l.catalogId) l.catalogId = was.catalogId;
  }
  const methodChange = clean(r.methodChange, 400);
  if (methodChange === "" && diffLines(current, ingredients).every((d) => d.kind === "same")) return null;
  return {
    assessment: clean(r.assessment, CRITIQUE_LIMITS.assessment),
    ingredients,
    reasons: (Array.isArray(r.reasons) ? r.reasons : [])
      .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
      .map((x) => ({ ingredient: clean(x.ingredient, LIMITS.ingredient), why: clean(x.why, CRITIQUE_LIMITS.reason) }))
      .filter((x) => x.why)
      .slice(0, CRITIQUE_LIMITS.reasons),
    methodChange,
    warnings: (Array.isArray(r.warnings) ? r.warnings : [])
      .map((w) => clean(w, CRITIQUE_LIMITS.warning))
      .filter(Boolean)
      .slice(0, 6),
  };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const same = (a: string, b: string) => norm(a) === norm(b);
const amountOf = (l: { amount: string; unit: string }) => [l.amount, l.unit].filter(Boolean).join(" ");

export interface LineDiff {
  ingredient: string;
  from: string | null;
  to: string | null;
  kind: "same" | "changed" | "added" | "removed";
}

/** Line-by-line comparison by ingredient wording (worked out here, not taken from the model). */
export function diffLines(
  before: { amount: string; unit: string; ingredient: string }[],
  after: { amount: string; unit: string; ingredient: string }[]
): LineDiff[] {
  const out: LineDiff[] = [];
  const used = new Set<number>();
  for (const a of after) {
    const i = before.findIndex((b, j) => !used.has(j) && same(b.ingredient, a.ingredient));
    if (i === -1) {
      out.push({ ingredient: a.ingredient, from: null, to: amountOf(a), kind: "added" });
      continue;
    }
    used.add(i);
    const b = before[i];
    const changed = norm(amountOf(b)) !== norm(amountOf(a));
    out.push({ ingredient: a.ingredient, from: amountOf(b), to: amountOf(a), kind: changed ? "changed" : "same" });
  }
  before.forEach((b, j) => {
    if (!used.has(j)) out.push({ ingredient: b.ingredient, from: amountOf(b), to: null, kind: "removed" });
  });
  return out;
}

/**
 * The trial form's lines (line-N-amount/unit/ingredient/catalog/was,
 * `lines` = count); blank and removed rows dropped. A line whose wording was
 * retyped (differs from line-N-was) loses its catalog link, so the bar
 * never follows the wrong bottle; the action re-resolves it from the text.
 */
export function readTrialLines(form: FormLike): RecipeLine[] {
  const count = Math.min(Number(form.get("lines")) || 0, LIMITS.ingredients);
  const out: RecipeLine[] = [];
  for (let i = 0; i < count; i++) {
    if (form.get(`line-${i}-remove`) === "on") continue;
    const ingredient = clean(form.get(`line-${i}-ingredient`), LIMITS.ingredient);
    const was = clean(form.get(`line-${i}-was`), LIMITS.ingredient);
    const line = {
      amount: clean(form.get(`line-${i}-amount`), LIMITS.amount),
      unit: clean(form.get(`line-${i}-unit`), LIMITS.unit),
      ingredient,
      catalogId: was && same(was, ingredient) ? cleanCatalogId(form.get(`line-${i}-catalog`)) : "",
    };
    if (line.ingredient) out.push(line);
  }
  return out;
}

/** Stored jsonb shape (same as cocktails.ingredients). */
export function toStoredLines(lines: RecipeLine[]) {
  return lines.map((l) => ({
    amount: l.amount,
    unit: l.unit,
    ingredient: l.ingredient,
    ...(l.catalogId ? { catalog_id: l.catalogId } : {}),
  }));
}

export const TRIAL_LIMITS = { critique: 800, reasoning: 2000, method: 2000 } as const;

/** What we store with a trial so we remember why: the assessment, then one line per change. */
export function proposalReasoning(p: Pick<Proposal, "assessment" | "reasons" | "methodChange">): string {
  return [
    p.assessment,
    ...p.reasons.map((r) => `• ${r.ingredient ? `${r.ingredient}: ` : ""}${r.why}`),
    p.methodChange ? `• Method: ${p.methodChange}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, TRIAL_LIMITS.reasoning);
}

const cleanBlock = (v: unknown, max: number) =>
  typeof v === "string" ? Array.from(v.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim()).slice(0, max).join("").trim() : "";

export interface TrialDraft {
  lines: RecipeLine[];
  method: string | null;
  critique: string | null;
  reasoning: string | null;
}

/** The "Save as a trial" form, cleaned and clamped; null if it has no ingredients left. */
export function readTrialForm(form: FormLike): TrialDraft | null {
  const lines = readTrialLines(form);
  if (lines.length === 0) return null;
  return {
    lines,
    method: cleanBlock(form.get("method"), TRIAL_LIMITS.method) || null,
    critique: clean(form.get("critique"), TRIAL_LIMITS.critique) || null,
    reasoning: cleanBlock(form.get("reasoning"), TRIAL_LIMITS.reasoning) || null,
  };
}

/** The proposed method: the current one with the suggested change added (editable before saving). */
export function proposedMethod(current: string | null, change: string): string {
  if (!change) return current ?? "";
  return current ? `${current} ${change}` : change;
}
