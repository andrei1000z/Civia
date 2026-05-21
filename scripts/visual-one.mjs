/**
 * Take ONE screenshot at a time. Avoids overwhelming the dev server with
 * concurrent navigations + compilation.
 *
 * Usage: node scripts/visual-one.mjs <path> <name> [viewport]
 *   node scripts/visual-one.mjs /sesizari-publice?view=map map mobile
 *   node scripts/visual-one.mjs /sesizari/00045 detail desktop
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const path = process.argv[2] ?? "/";
const name = process.argv[3] ?? "page";
const vpName = process.argv[4] ?? "mobile";

const VP = vpName === "desktop"
  ? { width: 1440, height: 900 }
  : { width: 390, height: 844 };

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const OUT = "screenshots";
if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const errs = [];
const context = await browser.newContext({
  viewport: VP,
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const page = await context.newPage();
page.on("console", (m) => { if (m.type() === "error") errs.push(`console: ${m.text()}`); });
page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));

const url = `${BASE}${path}`;
console.log(`Loading ${url} (${vpName})...`);

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);
  // Dismiss cookie banner
  try {
    const accept = page.getByRole("button", { name: /Accept toate/i }).first();
    if (await accept.isVisible({ timeout: 1500 })) {
      await accept.click();
      await page.waitForTimeout(500);
      console.log("  ✓ Cookie banner dismissed");
    }
  } catch { /* none */ }
  // Wait for maps or content to settle (longer for Leaflet)
  await page.waitForTimeout(6000);
  const filename = `${OUT}/${vpName}-${name}.png`;
  await page.screenshot({ path: filename, fullPage: false });
  console.log(`  ✓ saved → ${filename}`);
} catch (e) {
  console.error(`  ✗ ${e.message}`);
}

if (errs.length > 0) {
  console.log("\nErrors detected:");
  for (const e of errs) console.log(`  - ${e}`);
}

await context.close();
await browser.close();
