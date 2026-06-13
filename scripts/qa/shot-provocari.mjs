import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:1280,height:1000}, deviceScaleFactor:2 })).newPage();
await p.goto("http://localhost:3100/provocari", { waitUntil:"networkidle", timeout:60000 });
await p.waitForTimeout(2500);
await p.screenshot({ path:"C:/tmp/shots/07-provocari.png", fullPage:true });
console.log("shot provocari DONE");
await b.close();
