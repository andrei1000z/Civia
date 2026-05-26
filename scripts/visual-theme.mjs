/**
 * Theme screenshot — captures both light and dark mode of homepage.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "screenshots/theme";
if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });

const VP = { width: 1440, height: 900 };

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({
    viewport: VP,
    deviceScaleFactor: 1,
    colorScheme: theme,
  });
  await context.addInitScript((t) => {
    try {
      window.localStorage.setItem("civia-theme", t);
    } catch {}
  }, theme);

  const page = await context.newPage();
  const url = `${BASE}/`;
  console.log(`[${theme}] ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);
    try {
      const accept = page
        .getByRole("button", { name: /Accept toate|Accept|Continuă/i })
        .first();
      if (await accept.isVisible({ timeout: 1500 })) {
        await accept.click();
        await page.waitForTimeout(300);
      }
    } catch {}
    await page.waitForTimeout(2000);

    // Hero shot
    const heroFile = `${OUT}/${theme}-home-hero.png`;
    await page.screenshot({ path: heroFile, fullPage: false });
    console.log(`  ✓ ${heroFile}`);

    // Scroll to bottom for footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    const footerFile = `${OUT}/${theme}-home-footer.png`;
    await page.screenshot({ path: footerFile, fullPage: false });
    console.log(`  ✓ ${footerFile}`);
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
  }

  await context.close();
}

await browser.close();
console.log("done");
