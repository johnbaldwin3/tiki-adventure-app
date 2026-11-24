// Mock pieces for invite links (migration 0019), used by e2e/mock-supabase.mjs:
// create_invite / revoke_invite / invite_preview / claim_invite RPCs and a
// read of the invites table, with the same rules as the SQL functions
// (single use, 14-day expiry, a claim moves until the new person signs in).
import crypto from "node:crypto";

export function createInviteMocks({ tasters, accounts, connections, users, bearerEmail, readBody, sendJson, project }) {
  const invites = [];
  // Roomier than the real defaults: both Playwright projects share this server.
  const settings = { invites_enabled: true, max_members: 100, max_open_invites: 50 };

  const meOf = (req) => {
    const email = bearerEmail(req);
    return email ? (accounts.get(email) ?? null) : null;
  };
  const houseOf = (id) => tasters.find((t) => t.id === id)?.household_id;
  const isAdmin = (id) => tasters.find((t) => t.id === id)?.is_admin === true;
  const hasSignedIn = (tasterId) =>
    [...accounts].some(([email, id]) => id === tasterId && users.get(email)?.lastSignInAt);
  const isOpen = (i) => !i.claimed_at && !i.revoked_at && new Date(i.expires_at) > new Date();

  function initials(name) {
    const letters = name.toUpperCase().replace(/[^A-Z]/g, "") || "XX";
    const words = name.toUpperCase().replace(/[^A-Z ]/g, "").trim().split(/\s+/);
    const base = words.length >= 2 && words[0] && words.at(-1) ? words[0][0] + words.at(-1)[0] : (letters.slice(0, 2) + "X").slice(0, 2);
    const taken = (c) => tasters.some((t) => t.initials === c);
    if (!taken(base)) return base;
    for (const c of letters.slice(1) + "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (!taken(base + c)) return base + c;
    throw new Error("No free initials");
  }

  function claim({ p_token, p_name, p_email }) {
    const email = String(p_email ?? "").trim().toLowerCase();
    const name = String(p_name ?? "").trim();
    if (name.length < 1 || name.length > 40) return "bad_name";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "bad_email";
    const inv = invites.find((i) => i.token === p_token);
    if (!inv) return "unknown";
    if (inv.revoked_at) return "revoked";
    if (!settings.invites_enabled) return "closed";
    const existing = accounts.get(email) ?? null;
    if (inv.claimed_by) {
      if (hasSignedIn(inv.claimed_by)) return "used";
      if (existing && existing !== inv.claimed_by) return "email_taken";
      for (const [e, id] of accounts) if (id === inv.claimed_by) accounts.delete(e);
      accounts.set(email, inv.claimed_by);
      tasters.find((t) => t.id === inv.claimed_by).display_name = name;
      return "ok";
    }
    if (new Date(inv.expires_at) <= new Date()) return "expired";
    if (existing) return "email_taken";
    if (tasters.length >= settings.max_members) return "full";
    const id = `taster-${crypto.randomUUID().slice(0, 8)}`;
    tasters.push({ id, initials: initials(name), display_name: name, household_id: `household-${id}`, is_admin: false });
    accounts.set(email, id);
    connections.push([id, inv.invited_by].sort());
    inv.claimed_by = id;
    inv.claimed_at = new Date().toISOString();
    return "ok";
  }

  return function handleInviteMocks(req, res, url, table) {
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/)?.[1];
    if (req.method === "POST" && rpc === "create_invite") {
      readBody(req).then((body) => {
        const me = meOf(req);
        if (!me) return sendJson(res, 403, { code: "42501", message: "Only members can invite people." });
        if (!settings.invites_enabled) return sendJson(res, 400, { code: "P0001", message: "Invites are switched off right now." });
        if (tasters.length >= settings.max_members) return sendJson(res, 400, { code: "P0001", message: "The app is full for now." });
        if (invites.filter((i) => i.invited_by === me && isOpen(i)).length >= settings.max_open_invites) {
          return sendJson(res, 400, { code: "P0001", message: "You have too many unused invites. Revoke one first." });
        }
        const inv = {
          id: crypto.randomUUID(),
          token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
          invited_by: me,
          note: body.p_note ? String(body.p_note).trim() || null : null,
          created_at: new Date(Date.now() + invites.length).toISOString(),
          expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
          revoked_at: null,
          claimed_by: null,
          claimed_at: null,
        };
        invites.push(inv);
        sendJson(res, 200, inv.token);
      });
      return true;
    }
    if (req.method === "POST" && rpc === "revoke_invite") {
      readBody(req).then((body) => {
        const me = meOf(req);
        const inv = invites.find((i) => i.id === body.p_id);
        const ok = !!me && !!inv && !inv.claimed_at && !inv.revoked_at && (isAdmin(me) || houseOf(inv.invited_by) === houseOf(me));
        if (ok) inv.revoked_at = new Date().toISOString();
        sendJson(res, 200, ok);
      });
      return true;
    }
    if (req.method === "POST" && rpc === "invite_preview") {
      readBody(req).then((body) => {
        const inv = invites.find((i) => i.token === body.p_token);
        const status = !inv
          ? "unknown"
          : inv.revoked_at
            ? "revoked"
            : inv.claimed_by && hasSignedIn(inv.claimed_by)
              ? "used"
              : !inv.claimed_by && new Date(inv.expires_at) <= new Date()
                ? "expired"
                : !settings.invites_enabled
                  ? "closed"
                  : "ok";
        const inviter = inv ? (tasters.find((t) => t.id === inv.invited_by)?.display_name ?? null) : null;
        sendJson(res, 200, [{ status, inviter }]);
      });
      return true;
    }
    if (req.method === "POST" && rpc === "claim_invite") {
      readBody(req).then((body) => sendJson(res, 200, claim(body)));
      return true;
    }
    if (req.method === "GET" && table === "invites") {
      const me = meOf(req);
      let rows = invites.filter((i) => me && (isAdmin(me) || houseOf(i.invited_by) === houseOf(me)));
      for (const [key, value] of url.searchParams) {
        if (value.startsWith("eq.")) rows = rows.filter((r) => String(r[key]) === value.slice(3));
      }
      const desc = url.searchParams.get("order") === "created_at.desc";
      rows = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) * (desc ? -1 : 1));
      sendJson(res, 200, rows.map((r) => project(r, url.searchParams.get("select"))));
      return true;
    }
    return false;
  };
}
