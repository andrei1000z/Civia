// Verify a Vercel preview (behind Deployment Protection) using the
// Protection Bypass for Automation secret.
// Usage: VERCEL_BYPASS=<secret> node scripts/audit-preview-verify.mjs <previewBaseUrl>
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2];
const BYPASS = process.env.VERCEL_BYPASS;
if (!BASE || !BYPASS) { console.error("Need <baseUrl> arg + VERCEL_BYPASS env"); process.exit(1); }
const OUT = "audit/preview";
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  ["home", "/", "desktop"],
  ["home", "/", "mobile"],
  ["sesizari", "/sesizari", "desktop"],
  ["sesizari", "/sesizari", "mobile"],
  ["cj", "/cj", "desktop"],
];
const CONSOLE_PAGES = ["/cj", "/intreruperi", "/cj/harti", "/"];
const IGNORE = [/tile\.openstreetmap/, /plausible/, /favicon/, /analytics/, /openaq/, /open-meteo/, /seismicportal/, /nominatim/, /vercel/i];
const noisy = (s) => IGNORE.some((re) => re.test(s));

async function main() {
  const browser = await chromium.launch();
  const headers = { "x-vercel-protection-bypass": BYPASS, "x-vercel-set-bypass-cookie": "true" };

  // Screenshots
  for (const [slug, path, vp] of SHOTS) {
    const ctx = await browser.newContext({
      viewport: vp === "mobile" ? { width: 390, height: 844 } : { width: 1366, height: 900 },
      deviceScaleFactor: vp === "mobile" ? 2 : 1, isMobile: vp === "mobile", hasTouch: vp === "mobile",
      locale: "ro-RO", extraHTTPHeaders: headers,
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(25000);
    try {
      await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(2800);
      await page.screenshot({ path: `${OUT}/${vp}-${slug}.png`, fullPage: true });
      console.log(`SHOT ok  ${vp} ${path}`);
    } catch (e) { console.log(`SHOT FAIL ${vp} ${path} — ${String(e).slice(0, 80)}`); }
    await ctx.close();
  }

  // Console / hydration check
  console.log("\n=== CONSOLE / HYDRATION ===");
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "ro-RO", extraHTTPHeaders: headers });
  for (const path of CONSOLE_PAGES) {
    const page = await ctx.newPage();
    const errs = [], perr = [];
    page.on("console", (m) => { if (m.type() === "error" && !noisy(m.text())) errs.push(m.text().slice(0, 160)); });
    page.on("pageerror", (e) => perr.push(String(e).slice(0, 160)));
    let status = "?";
    try {
      const r = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 25000 });
      status = r ? r.status() : "?";
      await page.waitForTimeout(2500);
    } catch (e) { perr.push("NAV " + String(e).slice(0, 80)); }
    const hyd = [...errs, ...perr].filter((m) => /#418|#419|#423|hydrat|did not match|server rendered/i.test(m));
    console.log(`[${status}] ${path} — ${errs.length + perr.length} issues${hyd.length ? "  ⚠️ HYDRATION:" + hyd.length : ""}`);
    [...perr, ...hyd].slice(0, 3).forEach((m) => console.log("   " + m));
    await page.close();
  }
  await ctx.close();
  await browser.close();
  console.log(`\nScreenshots → ${OUT}/`);
}
main().catch((e) => { console.error(e); process.exit(1); });
