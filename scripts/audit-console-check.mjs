// One-shot runtime-error smoke check — visits each page, captures console errors,
// uncaught page errors, and 4xx/5xx responses. Usage: node scripts/audit-console-check.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] || "https://civia.ro";
const PAGES = [
  "/", "/sesizari", "/petitii", "/stiri", "/intreruperi", "/harti", "/buget",
  "/compara", "/impact", "/ghiduri", "/proteste", "/sesizari-publice", "/urmareste",
  "/cont", "/cj", "/cj/stiri", "/cj/harti", "/cj/intreruperi",
  "/legal/confidentialitate", "/legal/termeni",
];
// Known third-party noise to ignore (map tiles, analytics beacons, etc.).
const IGNORE = [/tile\.openstreetmap/, /plausible/, /favicon/, /analytics/, /openaq/, /open-meteo/, /seismicportal/, /nominatim/];
const noisy = (s) => IGNORE.some((re) => re.test(s));

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "ro-RO" });
  const results = [];
  for (const path of PAGES) {
    const page = await ctx.newPage();
    const consoleErrors = [], pageErrors = [], bad = [];
    page.on("console", (m) => { if (m.type() === "error" && !noisy(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
    page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
    page.on("response", (r) => { if (r.status() >= 400 && !noisy(r.url())) bad.push(r.status() + " " + r.url().replace(BASE, "").slice(0, 120)); });
    let status = "?";
    try {
      const resp = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 })
        .catch(() => page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 30000 }));
      status = resp ? resp.status() : "?";
      await page.waitForTimeout(1500);
    } catch (e) { pageErrors.push("NAV: " + String(e).slice(0, 120)); }
    results.push({ path, status, consoleErrors, pageErrors, bad });
    await page.close();
  }
  await browser.close();

  for (const r of results) {
    const n = r.consoleErrors.length + r.pageErrors.length;
    console.log(`\n[HTTP ${r.status}] ${r.path}  — ${n} JS issues, ${r.bad.length} bad requests`);
    r.pageErrors.forEach((e) => console.log("  PAGEERROR: " + e));
    r.consoleErrors.slice(0, 6).forEach((e) => console.log("  CONSOLE:   " + e));
    r.bad.slice(0, 6).forEach((e) => console.log("  REQ:       " + e));
  }
  const total = results.reduce((a, r) => a + r.consoleErrors.length + r.pageErrors.length, 0);
  const badTotal = results.reduce((a, r) => a + r.bad.length, 0);
  console.log(`\n=== TOTAL: ${total} JS issues, ${badTotal} bad requests across ${results.length} pages ===`);
}
main().catch((e) => { console.error(e); process.exit(1); });
