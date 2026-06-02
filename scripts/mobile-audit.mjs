import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = 'C:/tmp/mobile-screenshots';
mkdirSync(OUT, { recursive: true });

const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const BASE = 'https://www.civia.ro';
const PAGES = [
  { url: '/', name: '01-homepage' },
  { url: '/sesizari', name: '02-sesizari-form' },
  { url: '/sesizari-publice', name: '03-sesizari-publice' },
  { url: '/sesizari/00041', name: '04-sesizare-detail' },
  { url: '/sesizari/00051', name: '05-sesizare-trimis' },
  { url: '/stiri', name: '06-stiri' },
  { url: '/petitii', name: '07-petitii' },
  { url: '/propuneri-legislative', name: '08-propuneri-leg' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: MOBILE,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  isMobile: true, hasTouch: true,
});
const page = await ctx.newPage();

for (const p of PAGES) {
  process.stdout.write(`📸 ${p.name}... `);
  try {
    await page.goto(BASE + p.url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${p.name}-top.png` });
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${p.name}-mid.png` });
    console.log('✅');
  } catch (e) { console.log(`❌ ${e.message.slice(0,80)}`); }
}
await browser.close();
console.log(`\nDone → ${OUT}`);
