// Mock pieces for collections (migration 0011) and the IBA list (0012), used
// by e2e/mock-supabase.mjs. Seeds exactly what the migrations do, from the
// same seed-data files, and mirrors the RLS: anyone reads; only tasters
// write; built-in collections can't be deleted; names and slugs are unique;
// deleting a cocktail or collection removes its memberships (cascade).
import fs from "node:fs";
import path from "node:path";

export function seedIba(here, cocktails, slugify) {
  const iba = JSON.parse(fs.readFileSync(path.join(here, "..", "seed-data", "iba-cocktails.json"), "utf8"));
  iba.cocktails.forEach((c, i) => {
    if (slugify(c.name) !== c.slug) throw new Error(`mock: slug mismatch for ${c.name}`);
    cocktails.push({
      id: `iba-${i + 1}`,
      name: c.name,
      slug: c.slug,
      diffords_rank: null,
      diffords_guide_id: null,
      diffords_guide_url: null,
      primary_spirits: c.primarySpirits,
      glass: c.glass,
      garnish: c.garnish,
      method_summary: c.methodSummary,
      ingredients: c.ingredients,
      source: "iba",
      source_url: c.ibaUrl,
      source_note: `IBA official cocktail · ${c.ibaCategoryLabel}`,
      added_by: null,
      is_guess: false,
    });
  });
}

export function createCollectionMocks({ here, cocktails, accounts, bearerEmail, readBody, sendJson, project }) {
  const seed = JSON.parse(fs.readFileSync(path.join(here, "..", "seed-data", "collections.json"), "utf8"));
  const collections = [];
  const members = [];
  // Style tag fixes (migration 0013): tasters only; updated_by must be them.
  const styleFixes = [];

  function reset() {
    collections.length = 0;
    members.length = 0;
    styleFixes.length = 0;
    for (const c of seed.collections) {
      const col = {
        id: `col-${c.slug}`,
        slug: c.slug,
        name: c.name,
        description: c.description,
        sort_order: c.sortOrder,
        built_in: true,
      };
      collections.push(col);
      const add = (cocktail, note = null, noteUrl = null) => {
        if (!cocktail) throw new Error(`mock: no cocktail for collection ${c.slug}`);
        if (members.some((m) => m.collection_id === col.id && m.cocktail_id === cocktail.id)) return;
        members.push({ cocktail_id: cocktail.id, collection_id: col.id, note, note_url: noteUrl });
      };
      if (c.members === "all-diffords+ours") {
        for (const x of cocktails.filter((x) => x.source === "diffords" || x.source === "ours")) add(x);
      }
      for (const m of [...(Array.isArray(c.members) ? c.members : []), ...(c.extra ?? [])]) {
        add(
          cocktails.find((x) => x.name === m.name),
          m.note ?? null,
          m.noteUrl ?? null
        );
      }
    }
  }
  reset();

  const refuse = (res, table) =>
    sendJson(res, 403, { code: "42501", message: `new row violates row-level security policy for table "${table}"` });
  const eq = (url, key) => (url.searchParams.get(key) ?? "").replace(/^eq\./, "");
  const inList = (url, key) => {
    const m = (url.searchParams.get(key) ?? "").match(/^in\.\((.*)\)$/);
    return m ? m[1].split(",").map((s) => s.replace(/^"|"$/g, "")) : null;
  };

  function handleCollections(req, res, url, taster) {
    const select = url.searchParams.get("select");
    if (req.method === "POST") {
      return readBody(req).then((body) => {
        const row = [body].flat()[0];
        if (!taster || row.built_in) return refuse(res, "collections");
        if (collections.some((c) => c.name === row.name || c.slug === row.slug)) {
          return sendJson(res, 409, { code: "23505", message: 'duplicate key value violates unique constraint "collections_name_key"' });
        }
        collections.push({ id: `col-${row.slug}`, sort_order: 100, built_in: false, description: null, ...row });
        res.writeHead(201);
        res.end();
      });
    }
    const id = eq(url, "id");
    if (req.method === "PATCH") {
      return readBody(req).then((patch) => {
        const col = taster ? collections.find((c) => c.id === id) : null;
        if (col) for (const k of ["name", "description"]) if (k in patch) col[k] = patch[k];
        sendJson(res, 200, col ? [project(col, select)] : []);
      });
    }
    if (req.method === "DELETE") {
      const i = collections.findIndex((c) => c.id === id && !c.built_in);
      if (taster && i >= 0) {
        collections.splice(i, 1);
        for (let j = members.length - 1; j >= 0; j--) if (members[j].collection_id === id) members.splice(j, 1);
      }
      res.writeHead(204);
      res.end();
      return;
    }
    sendJson(res, 405, { message: "mock-supabase: unsupported collections method" });
  }

  function handleMembers(req, res, url, taster) {
    if (req.method === "POST") {
      if (url.searchParams.get("on_conflict") !== "collection_id,cocktail_id") {
        return sendJson(res, 400, { message: "mock-supabase: expected on_conflict=collection_id,cocktail_id" });
      }
      return readBody(req).then((body) => {
        if (!taster) return refuse(res, "cocktail_collections");
        for (const r of [body].flat()) {
          if (!collections.some((c) => c.id === r.collection_id) || !cocktails.some((c) => c.id === r.cocktail_id)) {
            return sendJson(res, 409, { code: "23503", message: "violates foreign key constraint" });
          }
          if (members.some((m) => m.collection_id === r.collection_id && m.cocktail_id === r.cocktail_id)) continue;
          members.push({ note: null, note_url: null, ...r });
        }
        res.writeHead(201);
        res.end();
      });
    }
    if (req.method === "DELETE") {
      const cocktailId = eq(url, "cocktail_id");
      const ids = inList(url, "collection_id") ?? [];
      if (taster) {
        for (let j = members.length - 1; j >= 0; j--) {
          if (members[j].cocktail_id === cocktailId && ids.includes(members[j].collection_id)) members.splice(j, 1);
        }
      }
      res.writeHead(204);
      res.end();
      return;
    }
    sendJson(res, 405, { message: "mock-supabase: unsupported cocktail_collections method" });
  }

  function handleStyleFixes(req, res, url) {
    for (let j = styleFixes.length - 1; j >= 0; j--) {
      if (!cocktails.some((c) => c.id === styleFixes[j].cocktail_id)) styleFixes.splice(j, 1);
    }
    if (req.method === "GET") {
      sendJson(res, 200, styleFixes.map((r) => project(r, url.searchParams.get("select"))));
      return;
    }
    const email = bearerEmail(req);
    const taster = email ? accounts.get(email) : null;
    if (req.method === "DELETE") {
      const id = eq(url, "cocktail_id");
      const keep = ((url.searchParams.get("tag") ?? "").match(/^not\.in\.\((.*)\)$/)?.[1] ?? "")
        .split(",")
        .filter(Boolean);
      if (taster) {
        for (let j = styleFixes.length - 1; j >= 0; j--) {
          if (styleFixes[j].cocktail_id === id && !keep.includes(styleFixes[j].tag)) styleFixes.splice(j, 1);
        }
      }
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "POST") {
      if (url.searchParams.get("on_conflict") !== "cocktail_id,tag") {
        return sendJson(res, 400, { message: "mock-supabase: expected on_conflict=cocktail_id,tag" });
      }
      readBody(req).then((body) => {
        const rows = [body].flat();
        if (!taster || rows.some((r) => r.updated_by !== taster)) return refuse(res, "cocktail_style_overrides");
        for (const r of rows) {
          const existing = styleFixes.find((f) => f.cocktail_id === r.cocktail_id && f.tag === r.tag);
          if (existing) Object.assign(existing, { include: r.include, updated_by: r.updated_by });
          else styleFixes.push({ cocktail_id: r.cocktail_id, tag: r.tag, include: r.include, updated_by: r.updated_by });
        }
        res.writeHead(201);
        res.end();
      });
      return;
    }
    sendJson(res, 405, { message: "mock-supabase: unsupported cocktail_style_overrides method" });
  }

  /** Returns true if it handled the request. */
  return function handle(req, res, url, tableName) {
    if (req.method === "POST" && url.pathname === "/__mock/reset-collections") {
      reset();
      res.writeHead(204);
      res.end();
      return true;
    }
    if (tableName === "cocktail_style_overrides") {
      handleStyleFixes(req, res, url);
      return true;
    }
    if (tableName !== "collections" && tableName !== "cocktail_collections") return false;
    // Cascade: memberships of cocktails that no longer exist are gone.
    for (let j = members.length - 1; j >= 0; j--) {
      if (!cocktails.some((c) => c.id === members[j].cocktail_id)) members.splice(j, 1);
    }
    if (req.method === "GET") {
      let rows = tableName === "collections" ? collections : members;
      for (const [key, value] of url.searchParams) {
        if (value.startsWith("eq.")) rows = rows.filter((r) => String(r[key]) === value.slice(3));
      }
      sendJson(res, 200, rows.map((r) => project(r, url.searchParams.get("select"))));
      return true;
    }
    const email = bearerEmail(req);
    const taster = email ? accounts.get(email) : null;
    if (tableName === "collections") handleCollections(req, res, url, taster);
    else handleMembers(req, res, url, taster);
    return true;
  };
}
