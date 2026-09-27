// Mock pieces for "our own recipes" (migration 0008) and the AI recipe
// helper, used by e2e/mock-supabase.mjs:
//  - cocktails writes: tasters may add/edit/delete only source='ours' rows,
//    added_by must be them on insert, name and slug are unique -- mirroring
//    the DB's RLS policies and constraints;
//  - a stand-in for OpenRouter's chat completions (OPENROUTER_BASE_URL
//    points here in e2e) with canned structured answers;
//  - a recipe web page (with schema.org JSON-LD) for the link import.

export function createRecipeMocks({ cocktails, tastings, accounts, bearerEmail, readBody, sendJson, project }) {
  function uniqueViolation(res, column) {
    sendJson(res, 409, { code: "23505", message: `duplicate key value violates unique constraint "cocktails_${column}_key"` });
  }

  function eqFilter(url) {
    const f = [];
    for (const [key, value] of url.searchParams) if (value.startsWith("eq.")) f.push([key, value.slice(3)]);
    return (r) => f.every(([k, v]) => String(r[k]) === v);
  }

  function handleCocktailWrite(req, res, url) {
    const email = bearerEmail(req);
    const taster = email ? accounts.get(email) : null;
    const select = url.searchParams.get("select");
    if (req.method === "POST") {
      readBody(req).then((body) => {
        const row = [body].flat()[0];
        if (!taster || row.source !== "ours" || row.added_by !== taster) {
          sendJson(res, 403, { code: "42501", message: 'new row violates row-level security policy for table "cocktails"' });
          return;
        }
        if (cocktails.some((c) => c.name === row.name)) return uniqueViolation(res, "name");
        if (cocktails.some((c) => c.slug === row.slug)) return uniqueViolation(res, "slug");
        cocktails.push({
          id: `ours-${Date.now()}-${cocktails.length}`,
          diffords_rank: null,
          diffords_guide_id: null,
          diffords_guide_url: null,
          primary_spirits: [],
          glass: null,
          garnish: null,
          method_summary: null,
          ingredients: [],
          source_url: null,
          source_note: null,
          ...row,
        });
        res.writeHead(201);
        res.end();
      });
      return;
    }
    // RLS: rows that aren't ours (or anything, for non-tasters) just don't match.
    const matches = cocktails.filter((c) => taster && c.source === "ours" && eqFilter(url)(c));
    if (req.method === "PATCH") {
      readBody(req).then((patch) => {
        if (patch.name && cocktails.some((c) => c.name === patch.name && !matches.includes(c))) {
          return uniqueViolation(res, "name");
        }
        const allowed = ["name", "primary_spirits", "glass", "garnish", "method_summary", "ingredients", "source_url", "source_note"];
        for (const c of matches) for (const k of allowed) if (k in patch) c[k] = patch[k];
        sendJson(res, 200, matches.map((c) => project(c, select)));
      });
      return;
    }
    if (req.method === "DELETE") {
      // Only the taster who added it may delete it.
      for (const c of matches.filter((m) => m.added_by === taster)) {
        cocktails.splice(cocktails.indexOf(c), 1);
        for (let i = tastings.length - 1; i >= 0; i--) if (tastings[i].cocktail_id === c.id) tastings.splice(i, 1);
      }
      sendJson(res, 200, matches.filter((m) => m.added_by === taster).map((c) => project(c, select)));
      return;
    }
    sendJson(res, 405, { message: "mock-supabase: unsupported cocktails method" });
  }

  let lastOpenRouter = null;
  function handleOpenRouter(req, res) {
    if (req.headers.authorization !== "Bearer e2e-openrouter-key") {
      sendJson(res, 401, { error: { message: "bad key" } });
      return;
    }
    readBody(req).then((body) => {
      lastOpenRouter = body;
      const parts = body.messages?.[1]?.content ?? [];
      const text = parts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
      const hasImage = parts.some((p) => p.type === "image_url" && /^data:image\/jpeg;base64,/.test(p.image_url?.url ?? ""));
      let answer;
      if (/NO RECIPE HERE/.test(text)) {
        answer = { found: false, name: "", primarySpirits: [], glass: "", garnish: "", method: "", ingredients: [], sourceNote: "", warnings: [] };
      } else {
        const name = hasImage ? "Photo Punch" : /Link Swizzle/.test(text) ? "Link Swizzle" : "Test Swizzle";
        answer = {
          found: true,
          name,
          primarySpirits: ["Navy rum"],
          glass: "Tiki mug",
          garnish: "Mint sprig",
          method: "Shake with ice and strain over crushed ice.",
          ingredients: [
            { amount: "2", unit: "fl oz", ingredient: "Navy rum", catalogId: "navy-rum" },
            { amount: "1", unit: "fl oz", ingredient: "Pineapple juice", catalogId: "pineapple-juice" },
            { amount: "3/4", unit: "fl oz", ingredient: "Fresh lime juice", catalogId: "lime" },
            { amount: "1", unit: "dash", ingredient: "House tincture", catalogId: "not-a-real-id" },
          ],
          sourceNote: hasImage ? "Test book, p. 12" : "",
          warnings: hasImage ? ["The garnish was hard to read."] : [],
        };
      }
      sendJson(res, 200, { choices: [{ message: { role: "assistant", content: JSON.stringify(answer) } }] });
    });
  }

  const RECIPE_PAGE = `<!doctype html><html><head><title>Link Swizzle</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Recipe","name":"Link Swizzle","recipeIngredient":["2 oz navy rum","1 oz pineapple juice"]}</script>
<script>var tracking = 1;</script></head><body><nav>Menu</nav><h1>Link Swizzle</h1><p>Shake &amp; strain.</p></body></html>`;

  /** Returns true if it handled the request. */
  return function handle(req, res, url, tableName) {
    if (req.method === "POST" && url.pathname === "/__mock/reset-recipes") {
      for (let i = cocktails.length - 1; i >= 0; i--) if (cocktails[i].source === "ours") cocktails.splice(i, 1);
      res.writeHead(204);
      res.end();
      return true;
    }
    if (req.method === "POST" && url.pathname === "/__openrouter/chat/completions") {
      handleOpenRouter(req, res);
      return true;
    }
    if (req.method === "GET" && url.pathname === "/__mock/last-openrouter") {
      sendJson(res, 200, lastOpenRouter);
      return true;
    }
    if (req.method === "GET" && url.pathname === "/__mock/recipe-page") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(RECIPE_PAGE);
      return true;
    }
    if (req.method === "GET" && url.pathname === "/__mock/redirect-to-page") {
      res.writeHead(302, { location: "/__mock/recipe-page" });
      res.end();
      return true;
    }
    if (tableName === "cocktails" && req.method !== "GET") {
      handleCocktailWrite(req, res, url);
      return true;
    }
    return false;
  };
}
