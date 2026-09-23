// Minimal stand-in for Supabase's PostgREST API, used only by the Playwright
// e2e suite. Automated environments for this project can't reach
// *.supabase.co (egress-blocked), and e2e runs should be deterministic
// anyway, so `npm run test:e2e` points the app at this server instead
// (see playwright.config.ts). It serves fixtures built from
// seed-data/cocktails.json -- the same verified data the real DB was
// seeded from -- and understands just the query shapes src/lib/cocktails.ts
// uses: `select` (incl. the embedded `tasters(...)` relation), `col=eq.val`
// filters, `order=col.asc|desc`, and (Phase 4) upserts into `tastings`
// (POST with on_conflict=cocktail_id,taster_id). Writes live in memory only.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(
  fs.readFileSync(path.join(here, "..", "seed-data", "cocktails.json"), "utf8")
);

// Mirror of src/lib/slug.ts (kept in plain JS so this server has no build step).
const slugify = (name) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['‘’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const tasters = [
  { id: "taster-jb", initials: "JB", display_name: "John" },
  { id: "taster-gm", initials: "GM", display_name: "Genny" },
];

const cocktails = seed.map((c, i) => ({
  id: `cocktail-${i + 1}`,
  name: c.name,
  slug: slugify(c.name),
  diffords_rank: c.diffordsRank,
  diffords_guide_id: c.diffordsGuideId ?? null,
  diffords_guide_url: c.diffordsGuideUrl,
  primary_spirits: c.primarySpirits ?? [],
  glass: c.glass ?? null,
  garnish: c.garnish ?? null,
  method_summary: c.methodSummary ?? null,
  ingredients: c.ingredients ?? [],
}));

const tastings = [];
seed.forEach((c, i) => {
  if (!c.tried) return;
  for (const [taster, rating, notes] of [
    [tasters[0], c.jbRating, c.jbNotes],
    [tasters[1], c.gmRating, c.gmNotes],
  ]) {
    tastings.push({
      cocktail_id: `cocktail-${i + 1}`,
      taster_id: taster.id,
      // Real PostgREST returns `numeric` columns as JSON strings.
      rating: rating === null || rating === undefined ? null : String(rating),
      notes: notes ?? null,
      tried: true,
      tasted_at: null,
    });
  }
});

const tables = { cocktails, tasters, tastings };

function project(row, select) {
  if (!select || select === "*") return { ...row };
  const out = {};
  // Split on commas that aren't inside an embed's parentheses.
  for (const part of select.split(/,(?![^(]*\))/).map((s) => s.trim())) {
    const embed = part.match(/^(\w+)\((.*)\)$/);
    if (embed && embed[1] === "tasters") {
      const t = tasters.find((x) => x.id === row.taster_id);
      out.tasters = t ? project(t, embed[2]) : null;
    } else if (part in row) {
      out[part] = row[part];
    }
  }
  return out;
}

function upsertTastings(req, res) {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const incoming = [JSON.parse(raw)].flat();
    for (const row of incoming) {
      const existing = tastings.find(
        (t) => t.cocktail_id === row.cocktail_id && t.taster_id === row.taster_id
      );
      const normalized = {
        ...row,
        rating: row.rating === null || row.rating === undefined ? null : String(row.rating),
      };
      if (existing) Object.assign(existing, normalized);
      else tastings.push({ notes: null, tried: true, tasted_at: null, ...normalized });
    }
    res.writeHead(201);
    res.end();
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const match = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
  const rows = match && tables[match[1]];
  if (req.method === "POST" && match?.[1] === "tastings") {
    // Only the service-role client may write, and only as an upsert on the
    // real unique key -- so e2e fails if the app ever writes with the anon
    // key or loses its on_conflict target.
    const key = req.headers["apikey"] ?? "";
    if (key !== "e2e-mock-service-key") {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "mock-supabase: writes need the service-role key" }));
      return;
    }
    if (url.searchParams.get("on_conflict") !== "cocktail_id,taster_id") {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "mock-supabase: expected on_conflict=cocktail_id,taster_id" }));
      return;
    }
    upsertTastings(req, res);
    return;
  }
  if (req.method !== "GET" || !rows) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: `mock-supabase: unsupported ${req.method} ${url.pathname}` }));
    return;
  }

  let result = rows.slice();
  for (const [key, value] of url.searchParams) {
    if (key === "select" || key === "order" || key === "limit") continue;
    if (value.startsWith("eq.")) {
      const want = value.slice(3);
      result = result.filter((r) => String(r[key]) === want);
    }
  }
  const order = url.searchParams.get("order");
  if (order) {
    const [col, dir] = order.split(".");
    result.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (dir === "desc" ? -1 : 1));
  }
  const body = result.map((r) => project(r, url.searchParams.get("select")));
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
});

const port = Number(process.env.MOCK_SUPABASE_PORT ?? 54329);
server.listen(port, "127.0.0.1", () => {
  console.log(`mock-supabase listening on http://127.0.0.1:${port}`);
});
