// One-shot audit screenshot capture — mobile + desktop, live site.
// Usage: node scripts/audit-screenshots.mjs [baseUrl]
// Saves to audit/screenshots/{viewport}-{slug}.png
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "https://civia.ro";
const OUT = "audit/screenshots";
mkdirSync(OUT, { recursive: true });

// Public pages (no auth). /cont shows the magic-link login when logged out — still useful.
const PAGES = [
  ["home", "/"],
  ["sesizari", "/sesizari"],
  ["petitii", "/petitii"],
  ["stiri", "/stiri"],
  ["intreruperi", "/intreruperi"],
  ["harti", "/harti"],
  ["buget", "/buget"],
  ["compara", "/compara"],
  ["impact", "/impact"],
  ["ghiduri", "/ghiduri"],
  ["proteste", "/proteste"],
  ["sesizari-publice", "/sesizari-publice"],
  ["urmareste", "/urmareste"],
  ["cont", "/cont"],
  ["judet-cj", "/cj"],
  ["judet-cj-stiri", "/cj/stiri"],
  ["judet-cj-harti", "/cj/harti"],
  ["judet-cj-intreruperi", "/cj/intreruperi"],
  ["legal-confidentialitate", "/legal/confidentialitate"],
  ["legal-termeni", "/legal/termeni"],
];

const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { name: "mobile", width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];

async function main() {
  const browser = await chromium.launch();
  let ok = 0, fail = 0;
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      colorScheme: "light",
      locale: "ro-RO",
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);
    for (const [slug, path] of PAGES) {
      const url = BASE + path;
      const file = `${OUT}/${vp.name}-${slug}.png`;
      try {
        // domcontentloaded only — realtime/polling pages never reach networkidle.
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(2500); // let animations/lazy content settle
        await page.screenshot({ path: file, fullPage: true, timeout: 20000 });
        console.log(`OK   ${vp.name.padEnd(7)} ${path}`);
        ok++;
      } catch (e) {
        console.log(`FAIL ${vp.name.padEnd(7)} ${path} — ${String(e).slice(0, 90)}`);
        fail++;
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\nDONE — ${ok} screenshots OK, ${fail} failed → ${OUT}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
