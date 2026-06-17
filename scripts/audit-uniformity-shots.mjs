// Uniformity visual sweep — key pages × light/dark on the live site.
// Relaunches the browser every BATCH pages to survive the OOM-prone machine.
// Usage: node scripts/audit-uniformity-shots.mjs [baseUrl]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "https://civia.ro";
const OUT = "audit/uniformity";
mkdirSync(OUT, { recursive: true });
const BATCH = 3; // relaunch browser every 3 shots to avoid OOM

const PAGES = [
  ["home", "/"], ["sesizari", "/sesizari"], ["sesizari-publice", "/sesizari-publice"],
  ["petitii", "/petitii"], ["stiri", "/stiri"], ["intreruperi", "/intreruperi"],
  ["buget", "/buget"], ["impact", "/impact"], ["compara", "/compara"],
  ["harti", "/harti"], ["ghiduri", "/ghiduri"], ["proteste", "/proteste"],
  ["autoritati", "/autoritati"], ["cont", "/cont"], ["cum-functioneaza", "/cum-functioneaza"],
];

async function shoot(jobs) {
  let ok = 0, fail = 0;
  for (let i = 0; i < jobs.length; i += BATCH) {
    const browser = await chromium.launch();
    const slice = jobs.slice(i, i + BATCH);
    for (const { slug, path, mode } of slice) {
      const ctx = await browser.newContext({
        viewport: { width: 1366, height: 900 }, colorScheme: mode, locale: "ro-RO",
      });
      const page = await ctx.newPage();
      page.setDefaultTimeout(22000);
      try {
        await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 22000 });
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${OUT}/${mode}-${slug}.png`, fullPage: false, timeout: 22000 });
        console.log(`OK   ${mode} ${path}`); ok++;
      } catch (e) {
        console.log(`FAIL ${mode} ${path} — ${String(e).slice(0, 60)}`); fail++;
      }
      await ctx.close();
    }
    await browser.close();
  }
  return { ok, fail };
}

const jobs = [];
for (const mode of ["dark", "light"]) for (const [slug, path] of PAGES) jobs.push({ slug, path, mode });

const r = await shoot(jobs);
console.log(`\nDONE — ${r.ok} ok, ${r.fail} fail → ${OUT}/`);
