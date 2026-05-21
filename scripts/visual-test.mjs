/**
 * Visual test platform — Playwright headless Chromium.
 * Takes screenshots of key pages and saves to ./screenshots/
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "screenshots";

const PAGES = [
  { name: "01-home",                    path: "/",                                       wait: 2500 },
  { name: "02-sesizari-publice-map",    path: "/sesizari-publice?view=map",              wait: 6000 },
  { name: "03-sesizari-publice-list",   path: "/sesizari-publice",                       wait: 2500 },
  { name: "04-sesizare-00045",          path: "/sesizari/00045",                         wait: 2500 },
  { name: "05-sesizari",                path: "/sesizari",                               wait: 2500 },
  { name: "06-petitii",                 path: "/petitii",                                wait: 2500 },
];

const VIEWPORTS = [
  { name: "mobile",  width: 390,  height: 844 }, // iPhone 14
];

async function run() {
  if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });

  // Use full chrome channel — chrome-headless-shell crashed on Windows during screenshot.
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const issues = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      colorScheme: "dark",
    });
    const page = await context.newPage();

    // Capture console errors + page errors per page
    for (const p of PAGES) {
      const errs = [];
      page.removeAllListeners("console");
      page.removeAllListeners("pageerror");
      page.on("console", (msg) => {
        if (msg.type() === "error") errs.push(`console: ${msg.text()}`);
      });
      page.on("pageerror", (err) => errs.push(`pageerror: ${err.message}`));

      const url = `${BASE}${p.path}`;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(p.wait);
        // Dismiss cookie banner if visible (blocks content on mobile).
        try {
          const accept = page.getByRole("button", { name: /Accept toate/i }).first();
          if (await accept.isVisible({ timeout: 1000 })) {
            await accept.click();
            await page.waitForTimeout(500);
          }
        } catch { /* no banner */ }
        const filename = `${OUT}/${vp.name}-${p.name}.png`;
        await page.screenshot({ path: filename, fullPage: false });
        console.log(`  ✓ ${vp.name} ${p.name} → ${filename}`);
      } catch (e) {
        console.error(`  ✗ ${vp.name} ${p.name}: ${e.message}`);
        errs.push(`navigation: ${e.message}`);
      }
      if (errs.length > 0) {
        issues.push({ viewport: vp.name, page: p.name, url, errors: errs });
      }
    }

    await context.close();
  }
  await browser.close();

  if (issues.length > 0) {
    console.log("\n=== ISSUES DETECTED ===");
    for (const i of issues) {
      console.log(`\n[${i.viewport}] ${i.page} (${i.url})`);
      for (const e of i.errors) console.log(`  - ${e}`);
    }
  } else {
    console.log("\n✓ No console errors or pageerrors detected.");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
