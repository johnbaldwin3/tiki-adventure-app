// Re-exports the PNG/ICO app icons from src/app/icon.svg (the master logo).
// Run after changing the logo:  node scripts/export-icons.mjs
// Needs Playwright's Chromium (npx playwright install chromium) and
// ImageMagick's `convert` for favicon.ico.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const src = readFileSync(join(root, "src/app/icon.svg"), "utf8");
// Apple icon: square corners (iOS rounds it itself) and no transparency.
const square = src.replace('rx="112" ', "");
// Maskable: full-bleed background with the artwork shrunk into the 80% safe zone.
const art = src.slice(src.indexOf("<!-- Setting sun -->"), src.lastIndexOf("</svg>"));
const maskable =
  src.slice(0, src.indexOf('<rect width="512"')) +
  '<rect width="512" height="512" fill="url(#ep-bg)"/>\n<g transform="translate(51.2 51.2) scale(0.8)">' +
  art +
  "</g>\n</svg>";

const tmp = mkdtempSync(join(tmpdir(), "icons-"));
mkdirSync(join(root, "public/icons"), { recursive: true });
const jobs = [
  [src, 16, join(tmp, "16.png")],
  [src, 32, join(tmp, "32.png")],
  [src, 48, join(tmp, "48.png")],
  [square, 180, join(root, "src/app/apple-icon.png")],
  [src, 192, join(root, "public/icons/icon-192.png")],
  [src, 512, join(root, "public/icons/icon-512.png")],
  [maskable, 512, join(root, "public/icons/icon-maskable-512.png")],
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [svg, size, out] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  const data = Buffer.from(svg).toString("base64");
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}</style><img style="display:block" width="${size}" height="${size}" src="data:image/svg+xml;base64,${data}">`,
  );
  await page.locator("img").evaluate((img) => img.decode());
  await page.screenshot({ path: out, omitBackground: true });
  console.log("wrote", out.replace(root, ""));
}
await browser.close();

execFileSync("convert", ["16.png", "32.png", "48.png", join(root, "src/app/favicon.ico")], { cwd: tmp });
console.log("wrote src/app/favicon.ico");
