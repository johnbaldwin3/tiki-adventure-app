import "server-only";
import http from "node:http";
import https from "node:https";
import {
  draftFromMenu,
  draftFromModel,
  libraryForPrompt,
  MENU_JSON_SCHEMA,
  MENU_SYSTEM,
  menuUserPrompt,
  pageText,
  parseCitations,
  type Citation,
  RECIPE_JSON_SCHEMA,
  recipeJsonLd,
  SYSTEM_PROMPT,
  userPrompt,
  type ImportKind,
  type ImportResult,
} from "../recipe-import";
import { makeSafeLookup } from "./net-guard";

/**
 * Server-side half of the AI recipe import: calls OpenRouter, and fetches
 * recipe web pages safely. The API key never leaves the server.
 *
 * Env: TIKI_OPEN_ROUTER_API_KEY (required), TIKI_OPENROUTER_MODEL
 * (optional, default below), OPENROUTER_BASE_URL (tests point it at the
 * mock), IMPORT_ALLOW_PRIVATE_HOSTS=1 (tests only: lets the mock's page
 * on 127.0.0.1 be fetched).
 */

export const DEFAULT_MODEL = "google/gemini-3.8-flash";
const MAX_PAGE_BYTES = 2_000_000;
/** The whole import (page fetch + model) must finish inside the route's 60s maxDuration. */
export const DEADLINE_MS = 50_000;
/** Only the first part of a page is read (keeps parsing fast on huge pages). */
const MAX_HTML_CHARS = 300_000;

export class ImportError extends Error {
  constructor(
    message: string,
    /** Safe to show the user. */
    readonly userMessage: string
  ) {
    super(message);
  }
}

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export interface ModelTask {
  system: string;
  schemaName: string;
  schema: object;
  /** Named in error messages, e.g. "The recipe helper". */
  label: string;
  maxTokens?: number;
  /** Let the model search the web (OpenRouter's web plugin; a few cents a call). */
  webSearch?: boolean;
}


const RECIPE_TASK: ModelTask = {
  system: SYSTEM_PROMPT,
  schemaName: "cocktail_recipe",
  schema: RECIPE_JSON_SCHEMA,
  label: "The recipe helper",
};

/** One structured-output call to the model (text and/or an image). Also used by the bottle/receipt scanner. */
export async function callModel(parts: ContentPart[], signal: AbortSignal, task: ModelTask = RECIPE_TASK): Promise<unknown> {
  return (await callModelWithCitations(parts, signal, task)).json;
}

/** Like callModel, plus the web pages the model cited (when web search is on). */
export async function callModelWithCitations(
  parts: ContentPart[],
  signal: AbortSignal,
  task: ModelTask
): Promise<{ json: unknown; citations: Citation[] }> {
  const key = process.env.TIKI_OPEN_ROUTER_API_KEY;
  if (!key) throw new ImportError("TIKI_OPEN_ROUTER_API_KEY is not set", `${task.label} isn't set up yet.`);
  // Tests point this at the mock; never overridable in production (the key goes wherever it points).
  const base = (TEST_OVERRIDES && process.env.OPENROUTER_BASE_URL) || "https://openrouter.ai/api/v1";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://tiki-adventure-app-beige.vercel.app",
      "X-Title": "Adventures in Tiki",
    },
    body: JSON.stringify({
      model: process.env.TIKI_OPENROUTER_MODEL || DEFAULT_MODEL,
      temperature: 0,
      max_tokens: task.maxTokens ?? 2000,
      messages: [
        { role: "system", content: task.system },
        { role: "user", content: parts },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: task.schemaName, strict: true, schema: task.schema },
      },
      ...(task.webSearch ? { plugins: [{ id: "web", max_results: 3 }] } : {}),
    }),
  }).catch((err) => {
    if (err?.name === "AbortError" || err?.name === "TimeoutError") {
      throw new ImportError("OpenRouter timeout", `${task.label} took too long. Please try again.`);
    }
    throw new ImportError(`OpenRouter request failed: ${err}`, `Couldn't reach ${task.label.toLowerCase()}. Please try again.`);
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new ImportError(
      `OpenRouter ${res.status}: ${detail}`,
      res.status === 429 ? `${task.label} is busy. Try again in a minute.` : `${task.label} had a problem. Please try again.`
    );
  }
  const body = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: unknown; annotations?: unknown } }[];
  } | null;
  const content = body?.choices?.[0]?.message?.content;
  const citations = parseCitations(body?.choices?.[0]?.message?.annotations);
  if (typeof content !== "string") throw new ImportError("OpenRouter: no content", `${task.label} didn't answer. Please try again.`);
  try {
    // Some models wrap JSON in a code fence despite structured output.
    return { json: JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "")), citations };
  } catch {
    throw new ImportError("OpenRouter: invalid JSON", `${task.label}'s answer didn't make sense. Please try again.`);
  }
}

const TEST_OVERRIDES = process.env.VERCEL_ENV !== "production";
/** Tests only (never in production): allow the mock's page on 127.0.0.1. */
const allowPrivate = () => TEST_OVERRIDES && process.env.IMPORT_ALLOW_PRIVATE_HOSTS === "1";
const safeLookup = makeSafeLookup();

interface Page {
  status: number;
  location: string | null;
  contentType: string;
  body: Buffer;
}

/** One GET with the SSRF-safe DNS lookup, a size cap and the shared deadline. */
function getOnce(url: URL, signal: AbortSignal): Promise<Page> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        signal,
        lookup: allowPrivate() ? undefined : (safeLookup as never),
        headers: { "User-Agent": "AdventuresInTiki/1.0 (private recipe import)", Accept: "text/html,text/plain" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        const contentType = String(res.headers["content-type"] ?? "");
        if ((status >= 300 && status < 400) || status >= 400) {
          res.resume();
          resolve({ status, location, contentType, body: Buffer.alloc(0) });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_PAGE_BYTES) {
            res.destroy();
            resolve({ status, location, contentType, body: Buffer.concat(chunks) });
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => resolve({ status, location, contentType, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.end();
  });
}

/** Fetches a public web page (http/https on ports 80/443, ≤3 redirects, ≤2 MB, HTML/text only). */
export async function fetchRecipePage(raw: string, signal: AbortSignal): Promise<{ url: string; html: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImportError("bad url", "That doesn't look like a web address.");
  }
  for (let hop = 0; hop <= 3; hop++) {
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
      throw new ImportError("bad scheme", "Use a normal web link (https://…).");
    }
    if (url.port && !allowPrivate() && url.port !== "80" && url.port !== "443") {
      throw new ImportError("bad port", "That link can't be opened from here.");
    }
    const page = await getOnce(url, signal).catch((err: NodeJS.ErrnoException) => {
      if (err?.code === "EBLOCKED") throw new ImportError(err.message, "That link can't be opened from here.");
      if (err?.name === "AbortError" || err?.name === "TimeoutError") throw new ImportError("page timeout", "That page took too long to load.");
      throw new ImportError(`fetch failed: ${err}`, "Couldn't open that page.");
    });
    if (page.status >= 300 && page.status < 400 && page.location) {
      url = new URL(page.location, url);
      continue;
    }
    if (page.status < 200 || page.status >= 300) {
      throw new ImportError(`page ${page.status}`, `That page answered with an error (${page.status}).`);
    }
    if (!/text\/html|text\/plain|application\/xhtml/.test(page.contentType)) {
      throw new ImportError(`content-type ${page.contentType}`, "That link isn't a web page.");
    }
    return { url: url.toString(), html: page.body.toString("utf8") };
  }
  throw new ImportError("too many redirects", "That link redirects too many times.");
}

/** Runs one import. Throws ImportError (with a user-safe message) on failure; null = no recipe found. */
export async function importRecipe(
  kind: ImportKind,
  input: { text?: string; url?: string; imageDataUrl?: string }
): Promise<ImportResult | null> {
  const signal = AbortSignal.timeout(DEADLINE_MS);
  if (kind === "photo") {
    const raw = await callModel(
      [
        { type: "text", text: userPrompt("photo", {}) },
        { type: "image_url", image_url: { url: input.imageDataUrl! } },
      ],
      signal
    );
    return draftFromModel(raw);
  }
  if (kind === "link") {
    const page = await fetchRecipePage(input.url!, signal);
    const html = page.html.slice(0, MAX_HTML_CHARS);
    const ld = recipeJsonLd(html);
    const text = `${ld ? `Structured recipe data:\n${ld}\n\n` : ""}Page text:\n${pageText(html)}`;
    const raw = await callModel([{ type: "text", text: userPrompt("link", { url: page.url, text }) }], signal);
    return draftFromModel(raw, page.url);
  }
  const raw = await callModel([{ type: "text", text: userPrompt("text", { text: input.text }) }], signal);
  return draftFromModel(raw);
}

/**
 * A best-guess recipe from a menu listing (text and/or a photo of the
 * menu), with our own recipes as the ratio library and optional web search.
 */
export async function guessFromMenu(input: {
  menu: string;
  name?: string;
  place?: string;
  imageDataUrl?: string;
  webSearch: boolean;
  library: { name: string; slug: string; lines: string[] }[];
}): Promise<ImportResult | null> {
  const parts: ContentPart[] = [
    { type: "text", text: menuUserPrompt({ menu: input.menu, name: input.name, place: input.place }, libraryForPrompt(input.library)) },
  ];
  if (input.imageDataUrl) parts.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  const { json, citations } = await callModelWithCitations(parts, AbortSignal.timeout(DEADLINE_MS), {
    system: MENU_SYSTEM,
    schemaName: "menu_recipe",
    schema: MENU_JSON_SCHEMA,
    label: "The recipe helper",
    maxTokens: 2500,
    webSearch: input.webSearch,
  });
  return draftFromMenu(json, { place: input.place, knownNames: new Map(input.library.map((r) => [r.name, r.slug])), citations });
}
