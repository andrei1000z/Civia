import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
mkdirSync("audit/clasament", { recursive: true });
const BASE = "https://civia-git-feat-clasament-rebuild-andreimusat.vercel.app";
const b = await chromium.launch();
for (const mode of ["dark", "light"]) {
  const ctx = await b.newContext({
    viewport: { width: 1366, height: 1150 }, colorScheme: mode, locale: "ro-RO",
    extraHTTPHeaders: { "x-vercel-protection-bypass": "VNuOdXaoXB0P7pJvBS0zmALPQ3NYIQd2", "x-vercel-set-bypass-cookie": "true" },
  });
  const p = await ctx.newPage();
  try {
    await p.goto(BASE + "/clasament", { waitUntil: "domcontentloaded", timeout: 25000 });
    await p.waitForTimeout(3000);
    await p.screenshot({ path: `audit/clasament/${mode}.png`, fullPage: false });
    console.log("OK " + mode);
  } catch (e) { console.log("FAIL " + mode + " " + String(e).slice(0, 70)); }
  await ctx.close();
}
await b.close();
