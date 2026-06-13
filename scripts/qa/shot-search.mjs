import { chromium } from "playwright";
const BASE = "http://localhost:3100";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(2500);
// deschide search cu Ctrl+K
await p.keyboard.press("Control+K");
await p.waitForTimeout(1200);
async function shot(q, name) {
  // golește + tastează
  await p.keyboard.down("Control"); await p.keyboard.press("A"); await p.keyboard.up("Control");
  await p.keyboard.press("Backspace");
  if (q) await p.keyboard.type(q, { delay: 30 });
  await p.waitForTimeout(1400); // debounce + fetch
  await p.screenshot({ path: `/tmp/shots/${name}.png` });
  console.log(`shot ${name} (q='${q}')`);
}
await shot("", "01-empty");
await shot("craiova", "02-craiova");
await shot("00035", "03-cod");
await shot("groapa", "04-groapa");
await b.close();
console.log("DONE");
