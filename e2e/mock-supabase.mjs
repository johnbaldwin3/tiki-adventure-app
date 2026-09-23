// Minimal stand-in for Supabase's PostgREST API, used only by the Playwright
// e2e suite. Automated environments for this project can't reach
// *.supabase.co (egress-blocked), and e2e runs should be deterministic
// anyway, so `npm run test:e2e` points the app at this server instead
// (see playwright.config.ts). It serves fixtures built from
// seed-data/cocktails.json -- the same verified data the real DB was
// seeded from -- and understands just the query shapes src/lib/cocktails.ts
// uses: `select` (incl. the embedded `tasters(...)` relation), `col=eq.val`
// filters, `order=col.asc|desc`, upserts into `tastings` (POST with
// on_conflict=cocktail_id,taster_id), and (Phase 7) a small stand-in for
// Supabase Auth: password sign-in, sign-up with a confirmation email, password
// reset, refresh, sign-out, and RLS-style "you can only write your own
// tastings". Emails aren't sent; tests read them from GET /__mock/outbox.
// Everything lives in memory for one test run.
import fs from "node:fs";
import crypto from "node:crypto";
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

// ---------------------------------------------------------------------------
// Auth stand-in (Phase 7)
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const match = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
  const rows = match && tables[match[1]];
  if (url.pathname.startsWith("/auth/v1/")) {
    handleAuth(req, res, url);
    return;
  }
  if (req.method === "GET" && url.pathname === "/__mock/outbox") {
    const to = url.searchParams.get("to");
    sendJson(res, 200, outbox.filter((m) => !to || m.to === to));
    return;
  }
  if (req.method === "POST" && url.pathname === "/rest/v1/rpc/current_taster_id") {
    const email = bearerEmail(req);
    sendJson(res, 200, email ? (accounts.get(email) ?? null) : null);
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
