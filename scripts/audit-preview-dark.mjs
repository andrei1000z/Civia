// Screenshot the preview deploy in DARK mode (verify shadow tokenization).
// Usage: node scripts/audit-preview-dark.mjs <previewBaseUrl> [bypassSecret]
// Dark mode triggers via colorScheme:"dark" → ThemeProvider default "system"
// resolves to dark via prefers-color-scheme. Bypass header unlocks protected preview.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2];
const BYPASS = process.argv[3] || "VNuOdXaoXB0P7pJvBS0zmALPQ3NYIQd2";
if (!BASE) { console.error("need preview base URL"); process.exit(1); }
const OUT = "audit/preview-dark";
mkdirSync(OUT, { recursive: true });

// Pages with shadow changes / high visibility.
const PAGES = [
  ["home", "/"], ["sesizari", "/sesizari"], ["petitii", "/petitii"],
  ["intreruperi", "/intreruperi"], ["buget", "/buget"], ["stiri", "/stiri"],
  ["cont", "/cont"], ["sesizari-publice", "/sesizari-publice"],
];

async function main() {
  const browser = await chromium.launch();
  let ok = 0, fail = 0;
  for (const mode of ["dark", "light"]) {
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      colorScheme: mode,
      locale: "ro-RO",
      extraHTTPHeaders: {
        "x-vercel-protection-bypass": BYPASS,
        "x-vercel-set-bypass-cookie": "true",
      },
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(25000);
    for (const [slug, path] of PAGES) {
      const file = `${OUT}/${mode}-${slug}.png`;
      try {
        await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 25000 });
        await page.waitForTimeout(2800);
        await page.screenshot({ path: file, fullPage: false, timeout: 25000 });
        console.log(`OK   ${mode.padEnd(5)} ${path}`);
        ok++;
      } catch (e) {
        console.log(`FAIL ${mode.padEnd(5)} ${path} — ${String(e).slice(0, 80)}`);
        fail++;
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\nDONE — ${ok} ok, ${fail} fail → ${OUT}/`);
}
main().catch((e) => { console.error(e); process.exit(1); });
