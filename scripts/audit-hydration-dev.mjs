// Capture verbose hydration errors in DEV mode (React names the exact mismatch).
// Usage: node scripts/audit-hydration-dev.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PAGES = ["/cj", "/intreruperi", "/cj/harti"];

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "ro-RO" });
  for (const path of PAGES) {
    const page = await ctx.newPage();
    const msgs = [];
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") msgs.push(`[${m.type()}] ${m.text()}`); });
    page.on("pageerror", (e) => msgs.push(`[pageerror] ${e.message}\n${e.stack ?? ""}`));
    console.log(`\n================ ${path} ================`);
    try {
      await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(5000); // let hydration run + React log
    } catch (e) {
      console.log("NAV ERROR:", String(e).slice(0, 200));
    }
    const hydration = msgs.filter((m) => /hydrat|did not match|server rendered|server-rendered|#41[89]|#42[35]|mismatch|tree hydrated|cannot be a child|in the server HTML|client properties/i.test(m));
    if (hydration.length) {
      console.log("--- HYDRATION (text complet) ---");
      hydration.forEach((m) => console.log(m.slice(0, 3000) + "\n----"));
    } else {
      console.log("(nicio eroare de hydration prinsă; total mesaje:", msgs.length, ")");
      msgs.slice(0, 6).forEach((m) => console.log(m.slice(0, 600)));
    }
    await page.close();
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
