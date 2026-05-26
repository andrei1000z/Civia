import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3003";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
});
await context.addInitScript(() => {
  try {
    window.localStorage.setItem("civia-theme", "dark");
  } catch {}
});
const page = await context.newPage();
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);
try {
  const accept = page
    .getByRole("button", { name: /Accept toate|Accept|Continuă/i })
    .first();
  if (await accept.isVisible({ timeout: 1500 })) {
    await accept.click();
    await page.waitForTimeout(300);
  }
} catch {}
// Scroll specifically la footer (selector mai precis decât bottomul body-ului)
await page.locator("footer").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(2000);
await page.screenshot({ path: "screenshots/theme/dark-home-footer.png", fullPage: false });
console.log("✓ dark-home-footer.png");
await context.close();
await browser.close();
