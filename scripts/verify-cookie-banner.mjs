import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  isMobile: true, hasTouch: true,
  // fresh context = no localStorage consent → banner will appear after 1.5s
});
const page = await ctx.newPage();
await page.goto('https://www.civia.ro/sesizari-publice', { waitUntil: 'networkidle', timeout: 25000 });
// wait for the 1.5s banner delay + render
await page.waitForTimeout(3000);

const result = await page.evaluate(() => {
  const banner = document.querySelector('[aria-labelledby="cookie-banner-title"]');
  const nav = document.querySelector('nav.lg\\:hidden') || [...document.querySelectorAll('nav')].find(n => n.className.includes('fixed') && n.className.includes('bottom-0'));
  const fab = document.querySelector('[data-civia-fab]');
  if (!banner) return { error: 'banner not visible' };
  const b = banner.getBoundingClientRect();
  const n = nav?.getBoundingClientRect();
  const fabStyle = fab ? getComputedStyle(fab).display : 'no-fab';
  // Do banner and nav overlap vertically?
  const overlap = n ? (b.bottom > n.top && b.top < n.bottom) : null;
  return {
    bannerBottom: Math.round(b.bottom),
    bannerTop: Math.round(b.top),
    navTop: n ? Math.round(n.top) : null,
    navBottom: n ? Math.round(n.bottom) : null,
    bannerNavOverlap: overlap,
    fabDisplay: fabStyle,
    cookieOpenAttr: document.documentElement.dataset.cookieOpen ?? 'unset',
  };
});

console.log(JSON.stringify(result, null, 2));
if (result.bannerNavOverlap === false && result.fabDisplay === 'none') {
  console.log('✅ FIX WORKS: banner deasupra nav, FAB ascuns');
} else if (result.error) {
  console.log('⚠️', result.error, '(poate consent deja salvat / deploy vechi)');
} else {
  console.log('❌ overlap:', result.bannerNavOverlap, '| fab:', result.fabDisplay);
}
await page.screenshot({ path: 'C:/tmp/mobile-screenshots/cookie-banner-fixed.png' });
await browser.close();
