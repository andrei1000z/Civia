// FAZA 5 — validează fundația design-system pe preview:
//  - /setari (panoul + slider + toggles)
//  - home la intensitate DEFAULT (no-regression) vs FROST (intensity=1) vs OPAQUE (0)
// Usage: node scripts/audit-glass-verify.mjs <previewBaseUrl> [bypassSecret]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2];
const BYPASS = process.argv[3] || "VNuOdXaoXB0P7pJvBS0zmALPQ3NYIQd2";
if (!BASE) { console.error("need preview base URL"); process.exit(1); }
const OUT = "audit/glass-verify";
mkdirSync(OUT, { recursive: true });

// [slug, path, glassIntensity|null]
const SHOTS = [
  ["setari-dark", "/setari", null],
  ["home-default", "/", null],
  ["home-frost", "/", "1"],
  ["home-opaque", "/", "0"],
  ["sesizari-dark", "/sesizari", null],
];

async function main() {
  const browser = await chromium.launch();
  let ok = 0, fail = 0;
  for (const [slug, path, intensity] of SHOTS) {
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      colorScheme: "dark",
      locale: "ro-RO",
      extraHTTPHeaders: {
        "x-vercel-protection-bypass": BYPASS,
        "x-vercel-set-bypass-cookie": "true",
      },
    });
    // Setează intensitatea ÎNAINTE de boot-script (addInitScript rulează primul).
    if (intensity !== null) {
      await ctx.addInitScript((v) => {
        try { localStorage.setItem("civia-glass-intensity", v); } catch {}
      }, intensity);
    }
    const page = await ctx.newPage();
    page.setDefaultTimeout(25000);
    try {
      await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(2800);
      await page.screenshot({ path: `${OUT}/${slug}.png`, fullPage: false, timeout: 25000 });
      console.log(`OK   ${slug}${intensity !== null ? ` (glass=${intensity})` : ""}`);
      ok++;
    } catch (e) {
      console.log(`FAIL ${slug} — ${String(e).slice(0, 80)}`);
      fail++;
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\nDONE — ${ok} ok, ${fail} fail → ${OUT}/`);
}
main().catch((e) => { console.error(e); process.exit(1); });
