/**
 * Screenshot ALL major routes in light mode (since we're auditing light
 * specifically). Runs serially to keep dev server stable.
 *
 * Outputs: screenshots/theme-all/light-{slug}.png
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3003";
const OUT = "screenshots/theme-all";
if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });

const ROUTES = [
  ["/", "home"],
  ["/sesizari", "sesizari"],
  ["/sesizari-publice", "sesizari-publice"],
  ["/sesizari-publice/harta", "sesizari-harta"],
  ["/sesizari-rezolvate", "sesizari-rezolvate"],
  ["/sesizari/00049", "sesizare-00049"],
  ["/petitii", "petitii"],
  ["/petitii/initiaza", "petitii-initiaza"],
  ["/stiri", "stiri"],
  ["/proteste", "proteste"],
  ["/intreruperi", "intreruperi"],
  ["/evenimente", "evenimente"],
  ["/autoritati", "autoritati"],
  ["/clasament", "clasament"],
  ["/cum-functioneaza", "cum-functioneaza"],
  ["/cum-fac", "cum-fac"],
  ["/ghiduri", "ghiduri"],
  ["/glosar", "glosar"],
  ["/intrebari-frecvente", "intrebari-frecvente"],
  ["/impact", "impact"],
  ["/actualizari", "actualizari"],
  ["/legal/termeni", "legal-termeni"],
  ["/legal/confidentialitate", "legal-confidentialitate"],
  ["/legal/cookie-policy", "legal-cookies"],
  ["/og-27-2002", "og-27-2002"],
  ["/drepturile-cetateanului", "drepturile-cetateanului"],
  ["/avocatul-poporului-online", "avp-online"],
  ["/scoala", "scoala"],
  ["/sesizare-vs-petitie", "sesizare-vs-petitie"],
  ["/statistici-sesizari-romania", "statistici-sesizari"],
  ["/press", "press"],
  ["/civic-quiz", "civic-quiz"],
  ["/hackathons", "hackathons"],
  // 1 county sample
  ["/cluj-napoca", "judet-cluj"],
];

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: "light",
});
await context.addInitScript(() => {
  try {
    window.localStorage.setItem("civia-theme", "light");
    // also dismiss cookie banner permanently
    window.localStorage.setItem("civia_cookie_consent", "accepted");
  } catch {}
});

const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message.slice(0, 200)}`));

for (const [path, slug] of ROUTES) {
  // Skip if we already have a screenshot pentru route asta (resume).
  const file = `${OUT}/light-${slug}.png`;
  if (existsSync(file)) {
    console.log(`⊙ skip ${path} (exists)`);
    continue;
  }
  // Retry o data dacă pică (turbopack cold-compile poate timeout).
  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    try {
      const start = Date.now();
      await page.goto(`${BASE}${path}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: file, fullPage: false });
      const ms = Date.now() - start;
      console.log(`✓ [${ms}ms attempt-${attempt}] ${path} → ${file}`);
      break;
    } catch (e) {
      console.log(`✗ attempt-${attempt} ${path} — ${e.message.slice(0, 100)}`);
      if (attempt < 2) await page.waitForTimeout(5000);
    }
  }
  // 2s cooldown între routes pentru dev server-ul de Next
  await page.waitForTimeout(1500);
}

await context.close();
await browser.close();

if (errors.length > 0) {
  console.log("\nPage errors:");
  for (const e of errors.slice(0, 30)) console.log(`  ${e}`);
}

console.log("done");
