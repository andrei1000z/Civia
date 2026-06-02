import { chromium } from 'playwright';

const OUT = 'C:/tmp/mobile-screenshots2';
import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });

const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const BASE = 'https://www.civia.ro';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: MOBILE,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  isMobile: true, hasTouch: true,
});
const page = await ctx.newPage();

// Test the fixed sesizare pages
for (const [url, name] of [
  ['/sesizari/00041', 'fixed-sesizare-detail'],
  ['/sesizari/00051', 'fixed-sesizare-trimis'],
]) {
  process.stdout.write(`📸 ${name}... `);
  await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}-top.png` });
  console.log('✅');
}
await browser.close();
console.log(`Done → ${OUT}`);
