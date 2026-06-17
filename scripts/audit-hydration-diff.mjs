// Pin a React hydration mismatch: render with JS OFF (pure server HTML) vs
// JS ON (hydrated DOM), then diff the visible text. A line that appears ONLY
// on server + a different one ONLY on client for the same spot = the #418 culprit.
// Usage: node scripts/audit-hydration-diff.mjs [baseUrl] [comma,paths]
import { chromium } from "playwright";

const BASE = process.argv[2] || "https://civia.ro";
const PATHS = (process.argv[3] || "/cj,/intreruperi").split(",");

async function getText(browser, url, js) {
  const ctx = await browser.newContext({ javaScriptEnabled: js, viewport: { width: 1366, height: 900 }, locale: "ro-RO" });
  const p = await ctx.newPage();
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (js) await p.waitForTimeout(3000); // let hydration + mount effects run
  } catch { /* ignore */ }
  const t = await p.evaluate(() => document.body.innerText).catch(() => "");
  await ctx.close();
  return t;
}
const lines = (t) => t.split("\n").map((s) => s.trim()).filter((s) => s.length > 1);
// known mounted-gated / client-only noise to ignore
const NOISE = [/^acum\b/i, /în urmă$/i, /se termină/i, /^(la|peste) /i, /mâine \d/i];
const noisy = (l) => NOISE.some((re) => re.test(l));

async function main() {
  const browser = await chromium.launch();
  for (const path of PATHS) {
    const server = lines(await getText(browser, BASE + path, false));
    const client = lines(await getText(browser, BASE + path, true));
    const sSet = new Set(server), cSet = new Set(client);
    const onlyServer = server.filter((l) => !cSet.has(l) && !noisy(l));
    const onlyClient = client.filter((l) => !sSet.has(l) && !noisy(l));
    console.log(`\n===== ${path} =====  (server ${server.length} linii / client ${client.length})`);
    console.log("--- DOAR pe SERVER (înlocuit la hydration) ---");
    if (!onlyServer.length) console.log("  (niciuna)");
    onlyServer.slice(0, 30).forEach((l) => console.log("  S: " + l.slice(0, 110)));
    console.log("--- DOAR pe CLIENT (după hydration) ---");
    if (!onlyClient.length) console.log("  (niciuna)");
    onlyClient.slice(0, 30).forEach((l) => console.log("  C: " + l.slice(0, 110)));
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
