import { slugify } from "./slug";

/**
 * Collections ("genres"): Tiki, Classics, Prohibition and any the tasters
 * add. A drink can be in several. Pure helpers; data access is in
 * src/lib/collections-data.ts. Migration 0011 has the tables and policies.
 */

export interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  /** Tiki, Classics, Prohibition: can be renamed but not deleted. */
  builtIn: boolean;
}

export interface Membership {
  cocktailId: string;
  collectionId: string;
  note: string | null;
  noteUrl: string | null;
}

/** The Tiki collection keeps the original "Adventures in Tiki" look and title. */
export const TIKI_SLUG = "tiki";
export const APP_NAME = "Equal Parts";

export const COLLECTION_LIMITS = { name: 40, description: 300 } as const;

export interface RawCollectionRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  built_in: boolean | null;
}

export interface RawMembershipRow {
  cocktail_id: string;
  collection_id: string;
  note?: string | null;
  note_url?: string | null;
}

export function mapCollections(rows: RawCollectionRow[]): Collection[] {
  return rows
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description ?? null,
      sortOrder: r.sort_order ?? 100,
      builtIn: r.built_in === true,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function mapMemberships(rows: RawMembershipRow[]): Membership[] {
  return rows.map((r) => ({
    cocktailId: r.cocktail_id,
    collectionId: r.collection_id,
    note: r.note ?? null,
    noteUrl: r.note_url && /^https?:\/\//i.test(r.note_url) ? r.note_url : null,
  }));
}

/** cocktail id -> slugs of the collections it's in (in collection order). */
export function collectionSlugsByCocktail(collections: Collection[], memberships: Membership[]): Map<string, string[]> {
  const order = new Map(collections.map((c, i) => [c.id, i]));
  const slugOf = new Map(collections.map((c) => [c.id, c.slug]));
  const out = new Map<string, string[]>();
  const sorted = memberships
    .filter((m) => slugOf.has(m.collectionId))
    .sort((a, b) => order.get(a.collectionId)! - order.get(b.collectionId)!);
  for (const m of sorted) {
    const list = out.get(m.cocktailId) ?? [];
    list.push(slugOf.get(m.collectionId)!);
    out.set(m.cocktailId, list);
  }
  return out;
}

/**
 * Reads ?c= (a collection slug). Unknown or missing -> null (all drinks),
 * so an old or mistyped link still shows the list.
 */
export function parseCollection(value: string | string[] | undefined, collections: Collection[]): Collection | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v) return null;
  return collections.find((c) => c.slug === v) ?? null;
}

/** Drinks in a collection (null = all drinks). */
export function inCollection<T extends { collections?: string[] }>(records: T[], collection: Collection | null): T[] {
  if (!collection) return records;
  return records.filter((r) => r.collections?.includes(collection.slug));
}

/** How many drinks each collection has (by slug). */
export function collectionCounts(records: { collections?: string[] }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of records) for (const s of r.collections ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
  return counts;
}

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? Array.from(v.replace(/\s+/g, " ").trim()).slice(0, max).join("").trim() : "";

export interface CollectionDraft {
  name: string;
  description: string;
}

export function readCollectionForm(form: { get(name: string): unknown }): CollectionDraft {
  return {
    name: clean(form.get("name"), COLLECTION_LIMITS.name),
    description: clean(form.get("description"), COLLECTION_LIMITS.description),
  };
}

export type NameProblem = "empty" | "symbols" | "reserved" | "taken";

export const NAME_PROBLEMS: Record<NameProblem, string> = {
  empty: "Give the collection a name.",
  symbols: "Use at least one letter or number in the name.",
  reserved: "That name is used by the site itself. Pick a different one.",
  taken: "Another collection already has that name (or one that makes the same link).",
};

/** What's wrong with a collection name, or null if it's fine. */
export function validateCollectionName(name: string, others: Collection[]): NameProblem | null {
  if (!name) return "empty";
  const slug = slugify(name);
  if (!slug) return "symbols";
  if (["all", "new", "manage"].includes(slug)) return "reserved";
  if (others.some((c) => c.name.toLowerCase() === name.toLowerCase() || c.slug === slug)) return "taken";
  return null;
}

export function parseNameProblem(value: unknown): NameProblem | null {
  return typeof value === "string" && value in NAME_PROBLEMS ? (value as NameProblem) : null;
}

/** URL slug for a new collection (fits the DB check: ≤40 chars, a-z0-9 and dashes). */
export function collectionSlug(name: string): string {
  return slugify(name).slice(0, 40).replace(/-+$/g, "");
}

/**
 * Which collections a checkbox form picked, limited to real collection ids
 * (form: repeated `collection` fields).
 */
export function readCollectionPicks(form: { getAll(name: string): unknown[] }, collections: Collection[]): string[] {
  const known = new Set(collections.map((c) => c.id));
  return [...new Set(form.getAll("collection").filter((v): v is string => typeof v === "string" && known.has(v)))];
}

/**
 * What to add and remove to go from the current memberships to the picked
 * ones. Only collections the form actually showed (`shown`) can be removed,
 * so one added since the page loaded isn't dropped by accident.
 */
export function planMembershipChange(
  current: string[],
  picked: string[],
  shown: string[] = current
): { add: string[]; remove: string[] } {
  const cur = new Set(current);
  const want = new Set(picked);
  const onForm = new Set(shown);
  return {
    add: picked.filter((id) => !cur.has(id)),
    remove: current.filter((id) => !want.has(id) && onForm.has(id)),
  };
}

/** Collection ids a form showed checkboxes for (repeated `shown` fields). */
export function readShownCollections(form: { getAll(name: string): unknown[] }): string[] {
  return [...new Set(form.getAll("shown").filter((v): v is string => typeof v === "string"))].slice(0, 200);
}

/** Tasted / total per collection, in collection order (empty collections left out). */
export function collectionProgress(
  collections: Collection[],
  records: { tried: boolean; collections?: string[] }[]
): { slug: string; name: string; tried: number; total: number }[] {
  return collections
    .map((c) => {
      const inIt = records.filter((r) => r.collections?.includes(c.slug));
      return { slug: c.slug, name: c.name, tried: inIt.filter((r) => r.tried).length, total: inIt.length };
    })
    .filter((p) => p.total > 0);
}
