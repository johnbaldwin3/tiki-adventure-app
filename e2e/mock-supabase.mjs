// Minimal stand-in for Supabase's PostgREST API, used only by the Playwright
// e2e suite. Automated environments for this project can't reach
// *.supabase.co (egress-blocked), and e2e runs should be deterministic
// anyway, so `npm run test:e2e` points the app at this server instead
// (see playwright.config.ts). It serves fixtures built from
// seed-data/cocktails.json -- the same verified data the real DB was
// seeded from -- and understands just the query shapes src/lib/cocktails.ts
// uses: `select` (incl. the embedded `tasters(...)` relation), `col=eq.val`
// filters, `order=col.asc|desc`, upserts into `tastings` (POST with
// on_conflict=cocktail_id,taster_id), and a small stand-in for
// Supabase Auth: password sign-in, sign-up with a confirmation email, password
// reset, refresh, sign-out, and RLS-style "you can only write your own
// tastings". Emails aren't sent; tests read them from GET /__mock/outbox.
// Everything lives in memory for one test run.
import fs from "node:fs";
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCollectionMocks, seedIba } from "./mock-collections.mjs";
import { createRecipeMocks } from "./mock-recipes.mjs";

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
  source: "diffords",
  source_url: null,
  source_note: null,
  added_by: null,
}));
// The IBA official cocktails (migration 0012), after the Top 100.
seedIba(here, cocktails, slugify);

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

// ---------------------------------------------------------------------------
// Auth stand-in
// ---------------------------------------------------------------------------

// Fake test-only password for the fake e2e accounts below (mirrored in e2e/auth.ts).
const E2E_PASSWORD = "tiki-e2e-pass-1";

// taster_accounts: which email belongs to which taster (the sign-up allowlist).
// Per-Playwright-project accounts for the sign-up and password-reset tests,
// since projects run in parallel against this one in-memory server.
const PROJECTS = ["chromium", "mobile-chrome"];
const accounts = new Map([
  ["john@e2e.test", "taster-jb"],
  ["genny@e2e.test", "taster-gm"],
  ...PROJECTS.map((p) => [`newbie-${p}@e2e.test`, "taster-gm"]), // allowlisted, not yet signed up
  ...PROJECTS.map((p) => [`reset-${p}@e2e.test`, "taster-gm"]),
  ...PROJECTS.map((p) => [`refresh-${p}@e2e.test`, "taster-gm"]),
]);
// Accounts whose access tokens last only 100s: after ~10s they're inside
// auth-js's 90s expiry margin, so the next navigation refreshes them. That
// exercises the proxy's cookie write-back, which is what keeps sign-ins alive
// for days. (Refresh tokens here are single-use, like Supabase's outside its
// short reuse window.)
const SHORT_LIVED = new Set(PROJECTS.map((p) => `refresh-${p}@e2e.test`));
const users = new Map(); // email -> { id, email, password, confirmed, createdAt }
for (const email of [
  "john@e2e.test",
  "genny@e2e.test",
  ...PROJECTS.map((p) => `reset-${p}@e2e.test`),
  ...PROJECTS.map((p) => `refresh-${p}@e2e.test`),
]) {
  users.set(email, { id: crypto.randomUUID(), email, password: E2E_PASSWORD, confirmed: true, createdAt: new Date().toISOString() });
}
const accessTokens = new Map(); // token -> email
const refreshTokens = new Map(); // token -> email
const codes = new Map(); // one-time code -> { email, type, challenge }
const outbox = []; // { to, type, link }

const b64url = (s) => Buffer.from(s).toString("base64url");
const nowSec = () => Math.floor(Date.now() / 1000);

function userJson(u) {
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: u.confirmed ? u.createdAt : null,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: u.createdAt,
    updated_at: u.createdAt,
  };
}

function newSession(u) {
  const ttl = SHORT_LIVED.has(u.email) ? 100 : 3600;
  const exp = nowSec() + ttl;
  // HS256-style header, so supabase-js verifies it by calling GET /auth/v1/user.
  const access = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", iat: nowSec(), exp, session_id: crypto.randomUUID() })
  )}.mock-signature`;
  const refresh = crypto.randomUUID();
  accessTokens.set(access, u.email);
  refreshTokens.set(refresh, u.email);
  return { access_token: access, token_type: "bearer", expires_in: ttl, expires_at: exp, refresh_token: refresh, user: userJson(u) };
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}
const authError = (res, status, code, msg) => sendJson(res, status, { code: status, error_code: code, msg });

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/** Email of the signed-in user behind this request's bearer token, if any. */
function bearerEmail(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  return accessTokens.get(token) ?? null;
}

function mailLink(to, type, redirectTo, challenge) {
  const code = crypto.randomUUID();
  codes.set(code, { email: to, type, challenge });
  const base = redirectTo || "http://127.0.0.1:3100/auth/confirm";
  outbox.push({ to, type, link: `${base}${base.includes("?") ? "&" : "?"}code=${code}` });
}

async function handleAuth(req, res, url) {
  if (process.env.MOCK_DEBUG) console.log("AUTH", req.method, url.pathname, url.search);
  const path = url.pathname.replace(/^\/auth\/v1/, "");
  if (req.method === "POST" && path === "/token") {
    const body = await readBody(req);
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const u = users.get(String(body.email ?? "").toLowerCase());
      if (!u || u.password !== body.password) return authError(res, 400, "invalid_credentials", "Invalid login credentials");
      if (!u.confirmed) return authError(res, 400, "email_not_confirmed", "Email not confirmed");
      return sendJson(res, 200, newSession(u));
    }
    if (grant === "refresh_token") {
      const email = refreshTokens.get(body.refresh_token);
      if (!email) return authError(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
      refreshTokens.delete(body.refresh_token);
      return sendJson(res, 200, newSession(users.get(email)));
    }
    if (grant === "pkce") {
      const entry = codes.get(body.auth_code);
      if (!entry) return authError(res, 400, "flow_state_not_found", "invalid flow state");
      // Real PKCE check: the verifier (a cookie in the browser that started
      // the flow) must hash to the challenge sent when the email was requested.
      const hashed = crypto.createHash("sha256").update(String(body.code_verifier ?? "")).digest("base64url");
      if (!entry.challenge || hashed !== entry.challenge) {
        return authError(res, 400, "bad_code_verifier", "code challenge does not match previously saved code verifier");
      }
      codes.delete(body.auth_code);
      const u = users.get(entry.email);
      u.confirmed = true;
      return sendJson(res, 200, newSession(u));
    }
    return authError(res, 400, "validation_failed", "unsupported grant_type");
  }
  if (req.method === "POST" && path === "/signup") {
    const body = await readBody(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    // Mirrors the enforce_taster_signup trigger (migration 0003).
    if (!accounts.has(email)) return authError(res, 500, "unexpected_failure", "Database error saving new user");
    // Like real Supabase with "Confirm email" on: an existing address gets an
    // ordinary-looking 200 and no email (so sign-up doesn't reveal accounts).
    if (users.has(email)) return sendJson(res, 200, { ...userJson(users.get(email)), id: crypto.randomUUID(), identities: [] });
    const u = { id: crypto.randomUUID(), email, password: body.password, confirmed: false, createdAt: new Date().toISOString() };
    users.set(email, u);
    mailLink(email, "signup", url.searchParams.get("redirect_to"), body.code_challenge);
    return sendJson(res, 200, userJson(u));
  }
  if (req.method === "POST" && path === "/recover") {
    const body = await readBody(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    if (users.has(email)) mailLink(email, "recovery", url.searchParams.get("redirect_to"), body.code_challenge);
    return sendJson(res, 200, {});
  }
  if (path === "/user") {
    const email = bearerEmail(req);
    if (!email) return authError(res, 403, "bad_jwt", "invalid JWT");
    const u = users.get(email);
    if (req.method === "PUT") {
      const body = await readBody(req);
      if (body.password) {
        if (body.password === u.password) return authError(res, 422, "same_password", "New password should be different from the old password.");
        u.password = body.password;
      }
    }
    return sendJson(res, 200, userJson(u));
  }
  if (req.method === "POST" && path === "/logout") {
    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    accessTokens.delete(token);
    res.writeHead(204);
    return res.end();
  }
  return authError(res, 404, "not_found", `mock-supabase: unsupported auth ${req.method} ${path}`);
}

const tables = { cocktails, tasters, tastings };

// Shared household tables -- the bar cabinet (migration 0006) and the
// shopping list (0007): rows are only visible/editable to signed-in
// tasters, and the owner column must be the signed-in taster -- mirroring
// RLS. Upserts honour Prefer: resolution=ignore-duplicates like PostgREST.
const shared = {
  cabinet_items: { rows: new Map(), owner: "updated_by", columns: ["bottle", "size_ml", "remaining_ml"] },
  shopping_items: { rows: new Map(), owner: "added_by", columns: [] },
};

function handleShared(name, req, res, url) {
  const table = shared[name];
  const email = bearerEmail(req);
  const taster = email ? accounts.get(email) : null;
  if (req.method === "GET") {
    sendJson(res, 200, taster ? [...table.rows.values()].map((r) => project(r, url.searchParams.get("select"))) : []);
    return;
  }
  if (!taster) {
    // RLS: a DELETE just matches no rows; an INSERT is refused.
    if (req.method === "DELETE") {
      res.writeHead(204);
      res.end();
      return;
    }
    sendJson(res, 403, { code: "42501", message: `new row violates row-level security policy for table "${name}"` });
    return;
  }
  if (req.method === "POST") {
    if (url.searchParams.get("on_conflict") !== "ingredient_id") {
      sendJson(res, 400, { message: "mock-supabase: expected on_conflict=ingredient_id" });
      return;
    }
    const ignoreDuplicates = /resolution=ignore-duplicates/.test(req.headers.prefer ?? "");
    readBody(req).then((body) => {
      const rows = [body].flat();
      if (rows.some((r) => r[table.owner] !== taster)) {
        sendJson(res, 403, { code: "42501", message: `new row violates row-level security policy for table "${name}"` });
        return;
      }
      for (const r of rows) {
        const existing = table.rows.get(r.ingredient_id);
        if (ignoreDuplicates && existing) continue;
        // Like PostgREST: an upsert updates only the columns it was sent.
        const row = existing ?? { ingredient_id: r.ingredient_id, ...Object.fromEntries(table.columns.map((c) => [c, null])) };
        row[table.owner] = r[table.owner];
        for (const c of table.columns) if (c in r) row[c] = r[c] ?? null;
        table.rows.set(r.ingredient_id, row);
      }
      res.writeHead(201);
      res.end();
    });
    return;
  }
  if (req.method === "PATCH") {
    // update ... where ingredient_id = eq.<id> (bottle levels)
    const id = (url.searchParams.get("ingredient_id") ?? "").replace(/^eq\./, "");
    readBody(req).then((patch) => {
      if (patch[table.owner] !== taster) {
        sendJson(res, 403, { code: "42501", message: `new row violates row-level security policy for table "${name}"` });
        return;
      }
      const row = table.rows.get(id);
      if (row) for (const c of [...table.columns, table.owner]) if (c in patch) row[c] = patch[c];
      sendJson(res, 200, row ? [project(row, url.searchParams.get("select"))] : []);
    });
    return;
  }
  if (req.method === "DELETE") {
    const m = (url.searchParams.get("ingredient_id") ?? "").match(/^in\.\((.*)\)$/);
    for (const id of m ? m[1].split(",").map((s) => s.replace(/^"|"$/g, "")) : []) table.rows.delete(id);
    res.writeHead(204);
    res.end();
    return;
  }
  sendJson(res, 405, { message: `mock-supabase: unsupported ${name} method` });
}

// "Database down" switch for e2e/db-down.spec.ts (POST /__mock/db-down with
// {"down": true|false}). While on, every PostgREST request returns 500; auth
// keeps working. That spec runs in its own Playwright project after the others.
let dbDown = false;

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

// Pours (migration 0009): record_pour / undo_pour RPCs count the tracked
// cabinet bottles down/up (never below 0 or above the bottle size), and
// pours rows can be read back by id. Tasters only, like the real RLS.
const pours = new Map();
function handlePours(req, res, url) {
  const email = bearerEmail(req);
  const taster = email ? accounts.get(email) : null;
  const cabinet = shared.cabinet_items.rows;
  if (req.method === "POST" && url.pathname === "/rest/v1/rpc/record_pour") {
    readBody(req).then((body) => {
      if (!taster) {
        sendJson(res, 403, { code: "42501", message: "not a taster" });
        return;
      }
      const lines = body.p_lines;
      if (!Array.isArray(lines) || lines.some((l) => typeof l.ml !== "number" || l.ml <= 0 || l.ml > 5000)) {
        return sendJson(res, 400, { code: "22023", message: "bad pour line" });
      }
      const id = body.p_pour_id;
      if (pours.has(id)) return sendJson(res, 200, id); // double submit
      const byId = new Map();
      for (const l of lines) byId.set(l.ingredient_id, (byId.get(l.ingredient_id) ?? 0) + l.ml);
      const recorded = [...byId.entries()].sort().map(([ingredient_id, ml]) => {
        const row = cabinet.get(ingredient_id);
        const have = row && row.remaining_ml !== null && row.remaining_ml !== undefined ? Number(row.remaining_ml) : null;
        const taken = have === null ? 0 : Math.min(have, ml);
        if (taken > 0) row.remaining_ml = have - taken;
        return { ingredient_id, ml, taken_ml: taken };
      });
      pours.set(id, { id, cocktail_id: body.p_cocktail_id, servings: body.p_servings, lines: recorded, poured_by: taster });
      sendJson(res, 200, id);
    });
    return true;
  }
  if (req.method === "POST" && url.pathname === "/rest/v1/rpc/undo_pour") {
    readBody(req).then((body) => {
      if (!taster) return sendJson(res, 403, { code: "42501", message: "not a taster" });
      const pour = pours.get(body.p_pour_id);
      if (!pour) return sendJson(res, 200, false);
      pours.delete(pour.id);
      for (const l of pour.lines) {
        const row = cabinet.get(l.ingredient_id);
        if (l.taken_ml > 0 && row && row.remaining_ml !== null && row.remaining_ml !== undefined) {
          const cap = row.size_ml ? Number(row.size_ml) : 99999;
          row.remaining_ml = Math.min(cap, Number(row.remaining_ml) + l.taken_ml);
        }
      }
      sendJson(res, 200, true);
    });
    return true;
  }
  if (req.method === "GET" && url.pathname === "/rest/v1/pours") {
    const id = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
    const cocktailId = (url.searchParams.get("cocktail_id") ?? "").replace(/^eq\./, "");
    const found = taster ? pours.get(id) : null;
    const pour = found && (!cocktailId || found.cocktail_id === cocktailId) ? found : null;
    sendJson(res, 200, pour ? [project(pour, url.searchParams.get("select"))] : []);
    return true;
  }
  return false;
}

const handleRecipeMocks = createRecipeMocks({ cocktails, tastings, accounts, bearerEmail, readBody, sendJson, project });
const handleCollectionMocks = createCollectionMocks({ here, cocktails, accounts, bearerEmail, readBody, sendJson, project });

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const match = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
  const rows = match && tables[match[1]];
  if (url.pathname.startsWith("/auth/v1/")) {
    handleAuth(req, res, url);
    return;
  }
  // Empties the shared household tables (cabinet, shopping list), so a
  // retried or re-run test starts clean.
  if (req.method === "POST" && url.pathname === "/__mock/reset-shared") {
    for (const t of Object.values(shared)) t.rows.clear();
    pours.clear();
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/__mock/db-down") {
    readBody(req).then((body) => {
      dbDown = !!body.down;
      sendJson(res, 200, { down: dbDown });
    });
    return;
  }
  if (dbDown && url.pathname.startsWith("/rest/v1/")) {
    sendJson(res, 500, { message: "mock-supabase: database is down (test switch)" });
    return;
  }
  if (req.method === "GET" && url.pathname === "/__mock/outbox") {
    const to = url.searchParams.get("to");
    sendJson(res, 200, outbox.filter((m) => !to || m.to === to));
    return;
  }
  if (handleRecipeMocks(req, res, url, match?.[1])) return;
  if (handleCollectionMocks(req, res, url, match?.[1])) return;
  if (handlePours(req, res, url)) return;
  if (req.method === "POST" && url.pathname === "/rest/v1/rpc/current_taster_id") {
    const email = bearerEmail(req);
    sendJson(res, 200, email ? (accounts.get(email) ?? null) : null);
    return;
  }
  if (match && Object.hasOwn(shared, match[1])) {
    handleShared(match[1], req, res, url);
    return;
  }
  if (req.method === "POST" && match?.[1] === "tastings") {
    // Emulates the RLS policies from migration 0003: only a signed-in taster,
    // and only rows for their own taster_id. Also insists on the real upsert
    // key, so e2e fails if the app loses its on_conflict target.
    const email = bearerEmail(req);
    const mine = email ? accounts.get(email) : null;
    if (url.searchParams.get("on_conflict") !== "cocktail_id,taster_id") {
      sendJson(res, 400, { message: "mock-supabase: expected on_conflict=cocktail_id,taster_id" });
      return;
    }
    readBody(req).then((body) => {
      const incoming = [body].flat();
      if (!mine || incoming.some((row) => row.taster_id !== mine)) {
        sendJson(res, 403, { code: "42501", message: 'new row violates row-level security policy for table "tastings"' });
        return;
      }
      for (const row of incoming) {
        const existing = tastings.find((t) => t.cocktail_id === row.cocktail_id && t.taster_id === row.taster_id);
        const normalized = { ...row, rating: row.rating === null || row.rating === undefined ? null : String(row.rating) };
        if (existing) Object.assign(existing, normalized);
        else tastings.push({ notes: null, tried: true, tasted_at: null, ...normalized });
      }
      res.writeHead(201);
      res.end();
    });
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
    const key = (r) => (r[col] === null || r[col] === undefined ? Infinity : r[col]);
    result.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * (dir === "desc" ? -1 : 1));
  }
  const body = result.map((r) => project(r, url.searchParams.get("select")));
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
});

const port = Number(process.env.MOCK_SUPABASE_PORT ?? 54329);
server.listen(port, "127.0.0.1", () => {
  console.log(`mock-supabase listening on http://127.0.0.1:${port}`);
});
